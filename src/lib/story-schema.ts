import { z } from "zod";
import { DEFAULT_MINIMUM_REPLY_LENGTH, normalizeMinimumReplyLength } from "@/lib/config";

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
  visibleReply: z.string().min(DEFAULT_MINIMUM_REPLY_LENGTH, `visibleReply 至少需要 ${DEFAULT_MINIMUM_REPLY_LENGTH} 字`),
  hiddenStateUpdate: hiddenStateUpdateSchema,
});

export type HiddenStateUpdate = z.infer<typeof hiddenStateUpdateSchema>;
export type NarrativeTurn = z.infer<typeof narrativeTurnSchema>;

function buildNarrativeTurnSchema(minimumReplyLength: number) {
  return z.object({
    visibleReply: z.string().min(minimumReplyLength, `visibleReply 至少需要 ${minimumReplyLength} 字`),
    hiddenStateUpdate: hiddenStateUpdateSchema,
  });
}

function parseJsonObject(rawText: string, emptyMessage: string) {
  const trimmed = rawText.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(emptyMessage);
    }
    return JSON.parse(match[0]);
  }
}

export function parseHiddenStateUpdate(rawText: string): HiddenStateUpdate {
  const parsed = parseJsonObject(rawText, "模型没有返回可解析的状态 JSON。");
  const candidate =
    parsed && typeof parsed === "object" && "hiddenStateUpdate" in parsed
      ? (parsed as { hiddenStateUpdate: unknown }).hiddenStateUpdate
      : parsed;
  const result = hiddenStateUpdateSchema.safeParse(candidate);

  if (!result.success) {
    throw new Error(`模型返回的状态 JSON 结构不符合预期：${result.error.message}`);
  }

  return result.data;
}

export function parseNarrativeTurn(rawText: string, options?: { minimumReplyLength?: number }): NarrativeTurn {
  const schema = buildNarrativeTurnSchema(normalizeMinimumReplyLength(options?.minimumReplyLength));
  const parsed = parseJsonObject(rawText, "模型没有返回可解析的 JSON。");
  const result = schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`模型返回的 JSON 结构不符合预期：${result.error.message}`);
  }

  return result.data;
}
