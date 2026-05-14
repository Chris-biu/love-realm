import { MessageRole } from "@prisma/client";
import { DEEPSEEK_BASE_URL, DEFAULT_DEEPSEEK_MODEL, normalizeDeepSeekModel } from "@/lib/config";
import type { SessionBundle } from "@/lib/session-service";

export type NovelExportMode = "quick" | "polished";

export type NovelExportOptions = {
  recentTurns?: number;
};

function sanitizeFilePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 48) || "novel";
}

export function buildNovelFileName(bundle: SessionBundle, date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${sanitizeFilePart(bundle.world.name)}_${sanitizeFilePart(bundle.title)}_${stamp}.md`;
}

function selectMessages(bundle: SessionBundle, options?: NovelExportOptions) {
  const recentTurns = options?.recentTurns && options.recentTurns > 0 ? Math.floor(options.recentTurns) : null;
  if (!recentTurns) return bundle.messages;
  const turnNumbers = Array.from(new Set(bundle.messages.map((message) => message.turnNumber))).slice(-recentTurns);
  const allowedTurns = new Set(turnNumbers);
  return bundle.messages.filter((message) => allowedTurns.has(message.turnNumber));
}

function formatPlayerAction(content: string) {
  return `这一刻，你选择${content.replace(/[。！？?]$/, "")}。`;
}

export function buildQuickNovelMarkdown(bundle: SessionBundle, options?: NovelExportOptions) {
  const messages = selectMessages(bundle, options);
  const lines: string[] = [
    `# ${bundle.title}`,
    "",
    `> 世界：${bundle.world.name}`,
    `> 当前场景：${bundle.sceneState.currentScene}`,
    `> 氛围：${bundle.sceneState.atmosphere}`,
    "",
  ];

  let currentTurn = 0;
  for (const message of messages) {
    if (message.turnNumber !== currentTurn) {
      currentTurn = message.turnNumber;
      lines.push("", `## 第 ${currentTurn} 章`, "");
    }

    if (message.role === MessageRole.USER) {
      lines.push(formatPlayerAction(message.content), "");
    } else {
      lines.push(message.content.trim(), "");
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function buildNovelPolishPrompts(bundle: SessionBundle, draftMarkdown: string) {
  const systemPrompt = [
    "你是一名中文长篇小说编辑，负责把互动叙事草稿润色成可连续阅读的小说章节。",
    "你只能输出 Markdown 小说正文，不要输出解释、分析、JSON 或聊天记录格式。",
    "改写目标：让文本像正常小说一样阅读，有章节标题、自然段落、场景衔接、人物动作、对白和心理描写。",
    "保留剧情事实、人物关系和玩家选择造成的关键变化，不要擅自改写世界观核心设定。",
    "不要出现“玩家：”“AI：”“系统：”等聊天日志称谓。",
  ].join("\n");

  const userPrompt = [
    "【世界名称】",
    bundle.world.name,
    "",
    "【世界前提】",
    bundle.world.premise,
    "",
    "【当前场景】",
    `${bundle.sceneState.currentScene} / ${bundle.sceneState.currentTime} / ${bundle.sceneState.atmosphere}`,
    "",
    "【长期记忆摘要】",
    bundle.memorySummaries.map((memory) => `- ${memory.content}`).join("\n") || "- 暂无",
    "",
    "【待润色互动草稿】",
    draftMarkdown,
  ].join("\n");

  return { systemPrompt, userPrompt };
}

function requireApiKey(apiKey?: string) {
  const resolved = apiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  if (!resolved) throw new Error("缺少 DeepSeek API Key。请在页面中输入，或在 .env 中配置 DEEPSEEK_API_KEY。");
  return resolved;
}

export async function polishNovelMarkdown(input: {
  bundle: SessionBundle;
  draftMarkdown: string;
  apiKey?: string;
  model?: string;
}) {
  const { systemPrompt, userPrompt } = buildNovelPolishPrompts(input.bundle, input.draftMarkdown);
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireApiKey(input.apiKey)}`,
    },
    body: JSON.stringify({
      model: normalizeDeepSeekModel(input.model || DEFAULT_DEEPSEEK_MODEL),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75,
      max_tokens: 16000,
    }),
  });

  const data = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }>; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(`小说润色失败：${data?.error?.message || `HTTP ${response.status}`}`);
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("小说润色返回为空。");
  return content;
}
