import type { HiddenStateUpdate } from "@/lib/story-schema";

export type GenerateVisibleReplyInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  minimumReplyLength?: number;
};

export type GenerateStateUpdateInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
};

export interface ModelAdapter {
  readonly provider: string;
  generateVisibleReply(input: GenerateVisibleReplyInput): Promise<string>;
  generateStateUpdate(input: GenerateStateUpdateInput): Promise<HiddenStateUpdate>;
}
