import { DEFAULT_MINIMUM_REPLY_LENGTH, normalizeMinimumReplyLength } from "@/lib/config";
import type { CharacterRuntimeState } from "@/lib/character-runtime-state";
import { getMetricMax } from "@/lib/relationship-scale";
import type { SessionBundle } from "@/lib/session-service";
import { getPacingDeltaRange } from "@/lib/story-director";
import { retrieveRelevantText } from "@/lib/story-retrieval";

function formatRelationshipMetrics(metrics: Record<string, number>) {
  return JSON.stringify(metrics, null, 2);
}

function formatAllowedCharacters(bundle: SessionBundle) {
  return bundle.characters
    .map((character) => `- ${character.name}（slug=${character.slug}，初始身份标签=${character.roleLabel}）`)
    .join("\n");
}

function formatRuntimeState(runtimeState: CharacterRuntimeState) {
  const lines: string[] = [];
  if (runtimeState.currentIdentity.value) lines.push(`当前身份：${runtimeState.currentIdentity.value}（来源=${runtimeState.currentIdentity.source}）`);
  if (runtimeState.currentRelationship.value) lines.push(`当前关系：${runtimeState.currentRelationship.value}（来源=${runtimeState.currentRelationship.source}）`);
  if (runtimeState.attitudeTowardPlayer.value) lines.push(`对玩家态度：${runtimeState.attitudeTowardPlayer.value}（来源=${runtimeState.attitudeTowardPlayer.source}）`);
  if (runtimeState.playerAddress.value) lines.push(`对玩家称呼：${runtimeState.playerAddress.value}（来源=${runtimeState.playerAddress.source}）`);
  if (runtimeState.persistentFacts.value.length) lines.push(`不可遗忘事实：${runtimeState.persistentFacts.value.join("；")}（来源=${runtimeState.persistentFacts.source}）`);
  return lines.length ? lines.join("\n") : "暂无动态档案";
}

function formatPlayerProfile(bundle: SessionBundle) {
  const profile = bundle.playerProfile;
  return [
    `主角显示名：${profile.displayName}`,
    `主角身份：${profile.role}`,
    `主角给人的表层印象：${profile.publicPersona || "未额外设定"}`,
    `主角背景：${profile.background || "未额外设定"}`,
    `主角当前动机：${profile.motivation || "未额外设定"}`,
    `主角说话风格：${profile.speakingStyle || "未额外设定"}`,
  ].join("\n");
}

function buildRetrievedContext(bundle: SessionBundle, userInput: string) {
  const retrieval = bundle.world.directorConfig.retrieval;
  const memoryMatches = retrieveRelevantText(
    bundle.memorySummaries.map((item) => item.content),
    userInput,
    retrieval.memoryLimit,
  );
  const factMatches = retrieveRelevantText(
    [
      ...bundle.sceneState.facts,
      ...bundle.characters.flatMap((character) => character.runtimeState.persistentFacts.value.map((fact) => `${character.name}：${fact}`)),
    ],
    userInput,
    retrieval.factLimit,
  );
  const dialogueMatches = retrieveRelevantText(
    bundle.messages
      .slice(-12)
      .map((message) => `${message.role === "USER" ? "玩家" : "叙事系统"}：${message.content}`),
    userInput,
    retrieval.dialogueLimit,
  );

  return {
    memoryMatches,
    factMatches,
    dialogueMatches,
  };
}

function buildContextSections(bundle: SessionBundle, userInput: string) {
  const latestScene = bundle.sceneState;
  const { memoryMatches, factMatches, dialogueMatches } = buildRetrievedContext(bundle, userInput);
  const statusMetricText = bundle.statusMetrics.length
    ? bundle.statusMetrics.map((metric) => `- ${metric.label}: key=${metric.key}, max=${getMetricMax(metric)}`).join("\n")
    : "- 当前世界没有启用角色状态栏字段";

  const memoryText = bundle.memorySummaries.map((item) => `- ${item.content}`).join("\n") || "- 暂无长期记忆摘要";

  const relationshipText = bundle.relationships
    .map((item) => {
      const metricLines = bundle.statusMetrics.map((metric) => {
        const value = item.metrics[metric.key] ?? 0;
        return `${metric.label}(${metric.key})=${value}/${getMetricMax(metric)}`;
      });
      return `${item.character.name}（${item.character.gender}）：${metricLines.join("；") || formatRelationshipMetrics(item.metrics)}`;
    })
    .join("\n");

  const recentDialogue =
    bundle.messages
      .slice(-8)
      .map((message) => `${message.role === "USER" ? "玩家" : "叙事系统"}：${message.content}`)
      .join("\n") || "暂无历史对话";

  const characterSheet = bundle.characters
    .map((character) =>
      [
        `角色：${character.name}`,
        `slug：${character.slug}`,
        `性别：${character.gender}`,
        `初始身份标签：${character.roleLabel}`,
        `公开设定：${character.publicSummary}`,
        `隐藏动机：${character.secretSummary}`,
        `性格标签：${character.personalityTags.join("、")}`,
        "当前动态档案：",
        formatRuntimeState(character.runtimeState),
      ].join("\n"),
    )
    .join("\n\n");

  const retrievedSummary = [
    "【RAG 检索命中】",
    `相关长期记忆：${memoryMatches.length ? memoryMatches.join("；") : "无"}`,
    `相关事实：${factMatches.length ? factMatches.join("；") : "无"}`,
    `相关对话：${dialogueMatches.length ? dialogueMatches.join("；") : "无"}`,
  ].join("\n");

  return [
    "【世界主设定】",
    `世界名称：${bundle.world.name}`,
    `世界简介：${bundle.world.description}`,
    `故事前提：${bundle.world.premise}`,
    `叙事规则：${bundle.world.storyGuide}`,
    "",
    "【主角档案】",
    formatPlayerProfile(bundle),
    "",
    "【导演节奏】",
    `推进速度：${bundle.world.directorConfig.pacing}`,
    `目标体验：${bundle.world.directorConfig.beatLabel}`,
    "",
    "【可用角色状态栏】",
    statusMetricText,
    "",
    "【角色设定】",
    characterSheet,
    "",
    "【本轮允许作为重要角色推进的人物白名单】",
    formatAllowedCharacters(bundle),
    "",
    "【当前场景】",
    `当前场景：${latestScene.currentScene}`,
    `当前时间：${latestScene.currentTime}`,
    `当前氛围：${latestScene.atmosphere}`,
    `场景摘要：${latestScene.summary}`,
    `最近场景变化：${latestScene.changes.join("；") || "无"}`,
    "",
    "【角色状态】",
    relationshipText,
    "",
    "【长期记忆摘要】",
    memoryText,
    "",
    "【最近若干轮对话】",
    recentDialogue,
    "",
    retrievedSummary,
    "",
    "【当前用户输入】",
    userInput,
  ].join("\n");
}

export function buildNarrativePrompts(bundle: SessionBundle, userInput: string, options?: { minimumReplyLength?: number }) {
  const minimumReplyLength = normalizeMinimumReplyLength(options?.minimumReplyLength ?? DEFAULT_MINIMUM_REPLY_LENGTH);
  const allowedCharacters = formatAllowedCharacters(bundle);
  const pacing = getPacingDeltaRange(bundle.world.directorConfig.pacing);

  const systemPrompt = [
    "你是一个由大语言模型驱动的恋爱互动叙事引擎，不是通用助手。",
    "你必须严格围绕世界设定、主角档案、角色设定、当前场景、角色状态、长期记忆和最近对话推进剧情。",
    "动态档案与初始角色卡冲突时，必须以动态档案为准；初始角色卡只代表故事起点。",
    "输出必须像持续推进的互动小说片段，而不是简短聊天回复。",
    `本局目标节奏是：${bundle.world.directorConfig.beatLabel}。`,
    "",
    "本阶段只生成玩家可见的剧情正文。",
    "不要输出 JSON，不要输出 Markdown 标题，不要输出解释、分析、字段名或系统状态。",
    `正文总长度必须不少于 ${minimumReplyLength} 个中文字符。宁可分层描写、扩写动作和对白，也不要短回复。`,
    "正文至少要包含：场景变化、环境或氛围描写、已知角色的动作或神态、至少一段角色对白、关系变化带来的情绪张力。",
    "如果当前场景只有一名已知角色，就用环境、心理、动作、沉默、距离变化和对白节奏补足张力，不得为了凑人数创造新角色。",
    "写法要自然流畅，有画面感，有互动张力，不要写成说明文。",
    "如果玩家输入很短，也必须根据当前上下文补足画面、对白和心理张力。",
    "",
    "重要角色反幻觉规则：",
    "1. 不得新增重要角色，不得主动创造有姓名、有身份线、有秘密动机或会推动主线的新人。",
    "2. 本轮允许作为重要角色推进的人物只能源自下列角色卡，或来自玩家当前输入明确点名的人物：",
    allowedCharacters,
    "3. 可以使用“路人、侍者、守卫、工作人员”等无名背景人物承接场面，但不能给他们姓名、关键身份、长期动机或关系线。",
    "4. 不得把无名背景人物写成新的核心角色，也不得让其抢走当前角色卡人物的戏份。",
  ].join("\n");

  return { systemPrompt, userPrompt: buildContextSections(bundle, userInput) };
}

export function buildStateUpdatePrompts(bundle: SessionBundle, userInput: string, visibleReply: string) {
  const allowedCharacters = formatAllowedCharacters(bundle);
  const pacing = getPacingDeltaRange(bundle.world.directorConfig.pacing);

  const systemPrompt = [
    "你是互动叙事产品的状态更新器。",
    "你必须根据世界设定、当前状态、玩家输入和已经生成的剧情正文，生成给系统保存的 hiddenStateUpdate。",
    "只输出严格 JSON，不得输出 JSON 之外的任何文字。",
    "JSON 结构必须为：",
    "{",
    '  "hiddenStateUpdate": {',
    '    "relationshipChanges": { "角色slug_状态key": number },',
    '    "characterStateUpdates": {',
    '      "角色slug": {',
    '        "currentIdentity": "当前身份",',
    '        "currentRelationship": "当前关系",',
    '        "attitudeTowardPlayer": "对玩家态度",',
    '        "playerAddress": "对玩家称呼",',
    '        "persistentFacts": ["不可遗忘事实"]',
    "      }",
    "    },",
    '    "sceneChanges": ["场景变化描述"],',
    '    "newFacts": ["新的事实"],',
    '    "memorySummary": "长期记忆摘要",',
    '    "currentScene": "当前场景",',
    '    "currentTime": "当前时间",',
    '    "atmosphere": "当前氛围",',
    '    "suggestedActions": ["建议一", "建议二", "建议三"]',
    "  }",
    "}",
    "",
    "强制要求：",
    "1. hiddenStateUpdate.currentScene、currentTime、atmosphere 每轮都要根据剧情重新判断并填写。",
    "2. sceneChanges 必须体现这一轮真正发生的变化，不能只是重复旧信息。",
    "3. relationshipChanges 的 key 必须使用 `角色slug_状态key` 格式，例如 `lin_yue_trust`。",
    "4. 只能更新【可用角色状态栏】里列出的状态 key，不能创造不存在的状态字段。",
    `5. relationshipChanges 只返回本轮变化量，建议控制在 ${pacing.min} 到 ${pacing.max} 之间。${pacing.summary}`,
    "6. memorySummary 要简洁总结这一轮最值得长期记住的剧情信息。",
    "7. suggestedActions 必须返回 3 条简短、可直接点击的剧情建议，要紧贴当前上下文。",
    "8. 不得把模型临时生成的无名背景人物写成重要人物、长期记忆对象、关系对象或 suggestedActions 的核心对象。",
    "9. 如果正文中出现未在白名单内、且非玩家明确点名的新姓名，hiddenStateUpdate 必须忽略该人物，不得为其创建关系变化或长期记忆。",
    "10. characterStateUpdates 用来维护角色当前身份、当前关系、对玩家态度、对玩家称呼和不可遗忘事实。",
    "11. 玩家手动设定来源为 PLAYER，优先级最高；你可以在 characterStateUpdates 中提出更新，但系统不会让 AI 覆盖 PLAYER 文本字段。",
    "12. 对于不可遗忘事实，如果玩家手动修订过已有事实，后续 AI 仍可补充新增事实，但不要重写玩家已经确认的旧事实。",
    "",
    "本轮重要角色白名单：",
    allowedCharacters,
  ].join("\n");

  const userPrompt = [
    buildContextSections(bundle, userInput),
    "",
    "【已经生成并展示给玩家的剧情正文】",
    visibleReply,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

export function buildPrompts(bundle: SessionBundle, userInput: string, options?: { minimumReplyLength?: number }) {
  return buildNarrativePrompts(bundle, userInput, options);
}
