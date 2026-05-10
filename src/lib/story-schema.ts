import { z } from "zod";

export const hiddenStateUpdateSchema = z.object({
  relationshipChanges: z.record(z.string(), z.number().int()).default({}),
  sceneChanges: z.array(z.string()).default([]),
  newFacts: z.array(z.string()).default([]),
  memorySummary: z.string().default(""),
  currentScene: z.string().optional(),
  currentTime: z.string().optional(),
  atmosphere: z.string().optional(),
  suggestedActions: z.array(z.string()).max(3).default([]),
});

export const narrativeTurnSchema = z.object({
  visibleReply: z.string().min(300, "visibleReply 至少需要 300 字"),
  hiddenStateUpdate: hiddenStateUpdateSchema,
});

export type HiddenStateUpdate = z.infer<typeof hiddenStateUpdateSchema>;
export type NarrativeTurn = z.infer<typeof narrativeTurnSchema>;

export function parseNarrativeTurn(rawText: string): NarrativeTurn {
  const trimmed = rawText.trim();

  try {
    const direct = narrativeTurnSchema.safeParse(JSON.parse(trimmed));
    if (direct.success) {
      return direct.data;
    }
  } catch {
    // 某些 provider 可能会在 JSON 外再包一层代码块或说明文字，继续做抽取。
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("模型没有返回可解析的 JSON。");
  }

  const extracted = narrativeTurnSchema.safeParse(JSON.parse(match[0]));
  if (!extracted.success) {
    throw new Error(`模型返回的 JSON 结构不符合预期：${extracted.error.message}`);
  }

  return extracted.data;
}
