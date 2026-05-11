import { DEEPSEEK_BASE_URL, normalizeMinimumReplyLength } from "@/lib/config";
import { parseHiddenStateUpdate } from "@/lib/story-schema";
import type { GenerateStateUpdateInput, GenerateVisibleReplyInput, ModelAdapter } from "@/lib/ai/types";

type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

function buildThinkingConfig(model: string) {
  if (model === "deepseek-v4-flash") {
    return {
      type: "disabled",
    };
  }

  return undefined;
}

function requireApiKey(overrideApiKey?: string) {
  const apiKey = overrideApiKey?.trim() || process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 DeepSeek API Key。请在页面中输入，或在 .env 中配置 DEEPSEEK_API_KEY。");
  }
  return apiKey;
}

function countCharacters(text: string) {
  return Array.from(text.trim()).length;
}

function buildContinuationPrompt(previousText: string, targetLength: number) {
  const currentLength = countCharacters(previousText);
  const remainingLength = Math.max(0, targetLength - currentLength);
  const tail = Array.from(previousText).slice(-1800).join("");

  return [
    `当前剧情正文约 ${currentLength} 字，目标是不少于 ${targetLength} 字，还至少需要补足 ${remainingLength} 字。`,
    "请从下方正文末尾自然续写，不要重复已经写过的句子，不要总结，不要输出 JSON，不要输出标题。",
    "续写必须继续推进场景、对白、动作和情绪张力，并保持同一轮互动的连贯性。",
    "",
    "【已生成正文末尾】",
    tail,
  ].join("\n");
}

export class DeepSeekAdapter implements ModelAdapter {
  readonly provider = "deepseek";

  private async requestText(input: {
    model: string;
    messages: DeepSeekMessage[];
    apiKey?: string;
    responseFormat?: { type: "json_object" };
  }) {
    const apiKey = requireApiKey(input.apiKey);
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        thinking: buildThinkingConfig(input.model),
        temperature: 0.9,
        max_tokens: 16000,
        ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      }),
    });

    const data = (await response.json().catch(() => null)) as DeepSeekResponse | null;

    if (!response.ok) {
      const detail = data?.error?.message || `HTTP ${response.status}`;
      throw new Error(`DeepSeek 调用失败：${detail}`);
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("DeepSeek 返回为空，未生成剧情结果。");
    }

    return content;
  }

  async generateVisibleReply(input: GenerateVisibleReplyInput) {
    const minimumReplyLength = normalizeMinimumReplyLength(input.minimumReplyLength);
    const segments: string[] = [
      await this.requestText({
        model: input.model,
        apiKey: input.apiKey,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
      }),
    ];

    const maxSegments = Math.min(10, Math.max(2, Math.ceil(minimumReplyLength / 2500) + 2));
    while (countCharacters(segments.join("\n\n")) < minimumReplyLength && segments.length < maxSegments) {
      const currentText = segments.join("\n\n");
      const continuation = await this.requestText({
        model: input.model,
        apiKey: input.apiKey,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: buildContinuationPrompt(currentText, minimumReplyLength) },
        ],
      });
      segments.push(continuation);
    }

    const visibleReply = segments.join("\n\n").trim();
    const finalLength = countCharacters(visibleReply);
    if (finalLength < minimumReplyLength) {
      throw new Error(`模型生成正文约 ${finalLength} 字，未达到本轮最低 ${minimumReplyLength} 字。请降低字数或稍后重试。`);
    }

    return visibleReply;
  }

  async generateStateUpdate(input: GenerateStateUpdateInput) {
    const content = await this.requestText({
      model: input.model,
      apiKey: input.apiKey,
      responseFormat: {
        type: "json_object",
      },
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    });

    return parseHiddenStateUpdate(content);
  }
}
