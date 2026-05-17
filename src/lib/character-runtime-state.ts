import type { Prisma } from "@prisma/client";

export type RuntimeStateSource = "AI" | "PLAYER";

export type RuntimeTextField = {
  value: string;
  source: RuntimeStateSource;
};

export type RuntimeFactsField = {
  highPriority: string[];
  standard: string[];
  source: RuntimeStateSource;
};

export type CharacterRuntimeState = {
  currentIdentity: RuntimeTextField;
  currentRelationship: RuntimeTextField;
  attitudeTowardPlayer: RuntimeTextField;
  playerAddress: RuntimeTextField;
  persistentFacts: RuntimeFactsField;
};

export type CharacterRuntimeStateUpdate = {
  currentIdentity?: string;
  currentRelationship?: string;
  attitudeTowardPlayer?: string;
  playerAddress?: string;
  persistentFacts?: {
    highPriority?: string[];
    standard?: string[];
  };
};

const EMPTY_STATE: CharacterRuntimeState = {
  currentIdentity: { value: "", source: "AI" },
  currentRelationship: { value: "", source: "AI" },
  attitudeTowardPlayer: { value: "", source: "AI" },
  playerAddress: { value: "", source: "AI" },
  persistentFacts: { highPriority: [], standard: [], source: "AI" },
};

function normalizeSource(value: unknown): RuntimeStateSource {
  return value === "PLAYER" ? "PLAYER" : "AI";
}

function normalizeTextField(value: unknown): RuntimeTextField {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { value: "", source: "AI" };
  const field = value as { value?: unknown; source?: unknown };
  return {
    value: typeof field.value === "string" ? field.value : "",
    source: normalizeSource(field.source),
  };
}

function normalizeFactsField(value: unknown): RuntimeFactsField {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { highPriority: [], standard: [], source: "AI" };
  const field = value as { value?: unknown; source?: unknown };
  const legacyValue = Array.isArray(field.value) ? field.value.filter((item): item is string => typeof item === "string") : [];

  if ("highPriority" in field || "standard" in field) {
    const nextField = field as { highPriority?: unknown; standard?: unknown; source?: unknown };
    return {
      highPriority: Array.isArray(nextField.highPriority)
        ? nextField.highPriority.filter((item): item is string => typeof item === "string")
        : [],
      standard: Array.isArray(nextField.standard)
        ? nextField.standard.filter((item): item is string => typeof item === "string")
        : legacyValue,
      source: normalizeSource(field.source),
    };
  }

  return {
    highPriority: [],
    standard: legacyValue,
    source: normalizeSource(field.source),
  };
}

function dedupeFacts(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function clampFactBuckets(facts: { highPriority: string[]; standard: string[] }) {
  return {
    highPriority: dedupeFacts(facts.highPriority).slice(0, 6),
    standard: dedupeFacts(facts.standard).slice(0, 12),
  };
}

export function normalizeCharacterRuntimeState(value: Prisma.JsonValue | unknown): CharacterRuntimeState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return structuredClone(EMPTY_STATE);
  const state = value as Record<string, unknown>;
  return {
    currentIdentity: normalizeTextField(state.currentIdentity),
    currentRelationship: normalizeTextField(state.currentRelationship),
    attitudeTowardPlayer: normalizeTextField(state.attitudeTowardPlayer),
    playerAddress: normalizeTextField(state.playerAddress),
    persistentFacts: normalizeFactsField(state.persistentFacts),
  };
}

function mergeTextField(current: RuntimeTextField, next: string | undefined, source: RuntimeStateSource) {
  const value = next?.trim();
  if (!value) return current;
  if (current.source === "PLAYER" && source === "AI") return current;
  return { value, source };
}

function mergeFactsField(
  current: RuntimeFactsField,
  next: { highPriority?: string[]; standard?: string[] } | undefined,
  source: RuntimeStateSource,
) {
  const incoming = clampFactBuckets({
    highPriority: next?.highPriority ?? [],
    standard: next?.standard ?? [],
  });
  if (!incoming.highPriority.length && !incoming.standard.length) return current;

  if (source === "PLAYER") {
    return {
      ...incoming,
      source: "PLAYER" as RuntimeStateSource,
    };
  }

  if (current.source === "PLAYER") {
    const currentBuckets = clampFactBuckets(current);
    return {
      highPriority: currentBuckets.highPriority,
      standard: clampFactBuckets({
        highPriority: [],
        standard: [...currentBuckets.standard, ...incoming.standard],
      }).standard,
      source: "PLAYER" as RuntimeStateSource,
    };
  }

  return {
    ...incoming,
    source,
  };
}

export function mergeCharacterRuntimeState(
  current: CharacterRuntimeState,
  update: CharacterRuntimeStateUpdate,
  source: RuntimeStateSource = "AI",
): CharacterRuntimeState {
  return {
    currentIdentity: mergeTextField(current.currentIdentity, update.currentIdentity, source),
    currentRelationship: mergeTextField(current.currentRelationship, update.currentRelationship, source),
    attitudeTowardPlayer: mergeTextField(current.attitudeTowardPlayer, update.attitudeTowardPlayer, source),
    playerAddress: mergeTextField(current.playerAddress, update.playerAddress, source),
    persistentFacts: mergeFactsField(current.persistentFacts, update.persistentFacts, source),
  };
}

export function serializeCharacterRuntimeState(state: CharacterRuntimeState): Prisma.InputJsonValue {
  return state as unknown as Prisma.InputJsonValue;
}
