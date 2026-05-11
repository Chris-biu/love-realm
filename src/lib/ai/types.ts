import type { NarrativeTurn } from "@/lib/story-schema";

export type GenerateTurnInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  apiKey?: string;
  minimumReplyLength?: number;
};

export interface ModelAdapter {
  readonly provider: string;
  generateTurn(input: GenerateTurnInput): Promise<NarrativeTurn>;
}
