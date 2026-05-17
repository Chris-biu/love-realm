import type { CharacterRuntimeState } from "@/lib/character-runtime-state";
import type { SessionBundle } from "@/lib/session-service";
import type { StatusMetricDefinition } from "@/lib/status-metrics";
import type { DirectorConfig, PlayerProfile } from "@/lib/story-director";

export type FeedbackTone = "default" | "success" | "pending";
export type NovelExportMode = "quick" | "polished";

export type WorldDraft = {
  name: string;
  description: string;
  premise: string;
  storyGuide: string;
  directorConfig: DirectorConfig;
};

export type PlayerProfileDraft = PlayerProfile;

export type CharacterDraft = {
  id: string;
  name: string;
  gender: string;
  roleLabel: string;
  publicSummary: string;
  secretSummary: string;
  personalityTagsText: string;
  currentIdentity: string;
  currentRelationship: string;
  attitudeTowardPlayer: string;
  playerAddress: string;
  persistentFactsText: string;
};

export const API_KEY_STORAGE_KEY = "moonlit_residence_deepseek_api_key";

const MODEL_LABELS: Record<string, string> = {
  "deepseek-v4-flash": "DeepSeek V4 Flash",
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "deepseek-chat": "DeepSeek Chat",
  "deepseek-reasoner": "DeepSeek Reasoner",
};

export const STARTER_PROMPTS = [
  "林月，你是不是一直在等我回来？",
  "今晚公馆里最不对劲的地方是什么？",
  "苏婉，今天餐厅里的气氛为什么这么安静？",
];

export function getModelLabel(model: string) {
  return MODEL_LABELS[model] || "自定义模型";
}

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "请求失败";
    throw new Error(message);
  }

  if (!data) {
    throw new Error("服务端返回为空");
  }

  return data;
}

export function splitParagraphs(content: string) {
  return content.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

export function getPacingLabel(pacing: DirectorConfig["pacing"]) {
  if (pacing === "slow") return "慢热";
  if (pacing === "fast") return "快节奏";
  return "均衡";
}

export function summarizePlayerProfile(profile: PlayerProfile) {
  return [profile.role, profile.publicPersona, profile.motivation].filter(Boolean).join(" / ");
}

export function createWorldDraft(session: SessionBundle): WorldDraft {
  return {
    name: session.world.name,
    description: session.world.description,
    premise: session.world.premise,
    storyGuide: session.world.storyGuide,
    directorConfig: session.world.directorConfig,
  };
}

export function createPlayerProfileDraft(session: SessionBundle): PlayerProfileDraft {
  return { ...session.playerProfile };
}

export function createCharacterDrafts(session: SessionBundle): CharacterDraft[] {
  return session.characters.map((character) => ({
    id: character.id,
    name: character.name,
    gender: character.gender,
    roleLabel: character.roleLabel,
    publicSummary: character.publicSummary,
    secretSummary: character.secretSummary,
    personalityTagsText: character.personalityTags.join("、"),
    currentIdentity: character.runtimeState.currentIdentity.value,
    currentRelationship: character.runtimeState.currentRelationship.value,
    attitudeTowardPlayer: character.runtimeState.attitudeTowardPlayer.value,
    playerAddress: character.runtimeState.playerAddress.value,
    persistentFactsText: character.runtimeState.persistentFacts.value.join("\n"),
  }));
}

export function parseRuntimeFacts(text: string) {
  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatRuntimeState(runtimeState: CharacterRuntimeState) {
  const lines: string[] = [];
  if (runtimeState.currentIdentity.value) lines.push(`当前身份：${runtimeState.currentIdentity.value}`);
  if (runtimeState.currentRelationship.value) lines.push(`当前关系：${runtimeState.currentRelationship.value}`);
  if (runtimeState.attitudeTowardPlayer.value) lines.push(`对玩家态度：${runtimeState.attitudeTowardPlayer.value}`);
  if (runtimeState.playerAddress.value) lines.push(`对玩家称呼：${runtimeState.playerAddress.value}`);
  if (runtimeState.persistentFacts.value.length) lines.push(`不会遗忘的事实：${runtimeState.persistentFacts.value.join("；")}`);
  return lines;
}

export function createMetricDrafts(session: SessionBundle): StatusMetricDefinition[] {
  return session.statusMetrics.map((metric) => ({ ...metric }));
}
