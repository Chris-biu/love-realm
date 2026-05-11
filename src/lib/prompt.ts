import { DEFAULT_MINIMUM_REPLY_LENGTH, normalizeMinimumReplyLength } from "@/lib/config";
import type { SessionBundle } from "@/lib/session-service";

function formatRelationshipMetrics(metrics: Record<string, number>) {
  return JSON.stringify(metrics, null, 2);
}

export function buildPrompts(bundle: SessionBundle, userInput: string, options?: { minimumReplyLength?: number }) {
  const minimumReplyLength = normalizeMinimumReplyLength(options?.minimumReplyLength ?? DEFAULT_MINIMUM_REPLY_LENGTH);
  const latestScene = bundle.sceneState;
  const statusMetricText = bundle.statusMetrics.length
    ? bundle.statusMetrics.map((metric) => `- ${metric.label}：key=${metric.key}`).join("\n")
    : "- 当前世界没有启用角色状态栏字段";

  const memoryText =
    bundle.memorySummaries.map((item) => `- ${item.content}`).join("\n") || "- 暂无长期记忆摘要";

  const relationshipText = bundle.relationships
    .map((item) => {
      const metricLines = bundle.statusMetrics.map((metric) => {
        const value = item.metrics[metric.key] ?? 0;
        return `${metric.label}(${metric.key})=${value}`;
      });
      return `${item.character.name}（${item.character.gender}）：${metricLines.join("，") || formatRelationshipMetrics(item.metrics)}`;
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
        `身份：${character.roleLabel}`,
        `公开设定：${character.publicSummary}`,
        `隐藏动机：${character.secretSummary}`,
        `性格标签：${character.personalityTags.join("、")}`,
      ].join("\n"),
    )
    .join("\n\n");

  const systemPrompt = [
    "你是一个由大语言模型驱动的恋爱互动叙事引擎，不是通用助手。",
    "你必须严格围绕世界设定、角色设定、当前场景、角色状态、长期记忆和最近对话来推进剧情。",
    "你的输出风格必须像持续推进的互动小说片段，而不是简短聊天回复。",
    "",
    "你每一轮都必须同时完成两件事：",
    "1. 生成给玩家看的 visibleReply。",
    "2. 生成给系统保存的 hiddenStateUpdate。",
    "",
    "你必须只输出严格 JSON，不得输出 JSON 之外的任何文字。",
    "JSON 结构必须为：",
    "{",
    '  "visibleReply": "给玩家看的剧情回复",',
    '  "hiddenStateUpdate": {',
    '    "relationshipChanges": { "角色slug_状态key": number },',
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
    `1. visibleReply 必须不少于 ${minimumReplyLength} 个中文字符。宁可写得更完整，也不要写短回复。`,
    "2. visibleReply 必须写成一段完整的剧情推进，至少包含：场景变化、环境或氛围描写、两个以上角色的动作或神态、至少一段角色对白、关系变化带来的情绪张力。",
    "3. 回复风格要自然流畅，有画面感，有情绪推进，不要写成说明文。",
    "4. hiddenStateUpdate.currentScene、currentTime、atmosphere 每轮都要根据剧情重新判断并填写。",
    "5. sceneChanges 必须体现这一轮真正发生的变化，不能只是重复旧信息。",
    "6. relationshipChanges 的 key 必须使用 `角色slug_状态key` 格式，例如 `lin_yue_trust`。",
    "7. 只能更新【可用角色状态栏】里列出的状态 key，不能创造不存在的状态字段。",
    "8. relationshipChanges 只返回本轮变化量，建议每项变化控制在 -2 到 2 之间。系统会把最终值限制在 0 到 10。",
    "9. memorySummary 要简洁总结这一轮最值得长期记住的剧情信息。",
    "10. suggestedActions 必须返回 3 条简短、可直接点击的剧情建议，要紧贴当前上下文。",
    "11. 如果玩家输入很短，也必须根据当前上下文补足画面、对白和心理张力，不能只回答一句话。",
    `12. 当前玩家设置的本轮最低回复字数是 ${minimumReplyLength}，必须满足该长度要求。`,
  ].join("\n");

  const userPrompt = [
    "【世界主设定】",
    `世界名称：${bundle.world.name}`,
    `世界简介：${bundle.world.description}`,
    `故事前提：${bundle.world.premise}`,
    `叙事规则：${bundle.world.storyGuide}`,
    "",
    "【可用角色状态栏】",
    statusMetricText,
    "",
    "【角色设定】",
    characterSheet,
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
    "【当前用户输入】",
    userInput,
  ].join("\n");

  return { systemPrompt, userPrompt };
}
