import { DEEPSEEK_BASE_URL } from "@/lib/config";
import { parseNarrativeTurn } from "@/lib/story-schema";
import type { GenerateTurnInput, ModelAdapter } from "@/lib/ai/types";

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

export class DeepSeekAdapter implements ModelAdapter {
  readonly provider = "deepseek";

  async generateTurn(input: GenerateTurnInput) {
    const apiKey = requireApiKey(input.apiKey);
    const messages: DeepSeekMessage[] = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ];

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        thinking: buildThinkingConfig(input.model),
        temperature: 0.9,
        max_tokens: 2200,
        response_format: {
          type: "json_object",
        },
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

    return parseNarrativeTurn(content);
  }
}
