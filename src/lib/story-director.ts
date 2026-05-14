export type DirectorPacing = "slow" | "balanced" | "fast";

export type RetrievalConfig = {
  memoryLimit: number;
  factLimit: number;
  dialogueLimit: number;
};

export type DirectorConfig = {
  pacing: DirectorPacing;
  beatLabel: string;
  retrieval: RetrievalConfig;
};

export type PlayerProfile = {
  displayName: string;
  role: string;
  publicPersona: string;
  background: string;
  motivation: string;
  speakingStyle: string;
};

export const DEFAULT_PLAYER_PROFILE: PlayerProfile = {
  displayName: "玩家",
  role: "故事主角",
  publicPersona: "",
  background: "",
  motivation: "",
  speakingStyle: "",
};

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  pacing: "balanced",
  beatLabel: "steady romantic tension",
  retrieval: {
    memoryLimit: 4,
    factLimit: 6,
    dialogueLimit: 6,
  },
};

function clampCount(value: unknown, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}

export function normalizePlayerProfile(value: unknown): PlayerProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_PLAYER_PROFILE };
  }

  const profile = value as Partial<PlayerProfile>;
  return {
    displayName: typeof profile.displayName === "string" && profile.displayName.trim()
      ? profile.displayName.trim()
      : DEFAULT_PLAYER_PROFILE.displayName,
    role: typeof profile.role === "string" && profile.role.trim()
      ? profile.role.trim()
      : DEFAULT_PLAYER_PROFILE.role,
    publicPersona: typeof profile.publicPersona === "string" ? profile.publicPersona.trim() : "",
    background: typeof profile.background === "string" ? profile.background.trim() : "",
    motivation: typeof profile.motivation === "string" ? profile.motivation.trim() : "",
    speakingStyle: typeof profile.speakingStyle === "string" ? profile.speakingStyle.trim() : "",
  };
}

export function normalizeDirectorConfig(value: unknown): DirectorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(DEFAULT_DIRECTOR_CONFIG);
  }

  const config = value as Partial<DirectorConfig> & { retrieval?: Partial<RetrievalConfig> };
  const pacing = config.pacing === "slow" || config.pacing === "fast" ? config.pacing : "balanced";

  return {
    pacing,
    beatLabel: typeof config.beatLabel === "string" && config.beatLabel.trim()
      ? config.beatLabel.trim()
      : DEFAULT_DIRECTOR_CONFIG.beatLabel,
    retrieval: {
      memoryLimit: clampCount(config.retrieval?.memoryLimit, DEFAULT_DIRECTOR_CONFIG.retrieval.memoryLimit, 1, 12),
      factLimit: clampCount(config.retrieval?.factLimit, DEFAULT_DIRECTOR_CONFIG.retrieval.factLimit, 1, 12),
      dialogueLimit: clampCount(config.retrieval?.dialogueLimit, DEFAULT_DIRECTOR_CONFIG.retrieval.dialogueLimit, 2, 12),
    },
  };
}

export function getPacingDeltaRange(pacing: DirectorPacing) {
  if (pacing === "slow") return { min: -1, max: 1, summary: "每轮关系变动以细水长流为主，避免跨阶段跳跃。" };
  if (pacing === "fast") return { min: -3, max: 3, summary: "每轮关系变动可以更明显，允许更快推进强情绪和高风险互动。" };
  return { min: -2, max: 2, summary: "每轮关系变化保持自然推进，允许适度升温或降温。" };
}
