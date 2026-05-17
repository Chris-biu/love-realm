import { MessageRole, Prisma } from "@prisma/client";
import {
  AVAILABLE_DEEPSEEK_MODELS,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_MINIMUM_REPLY_LENGTH,
  DEFAULT_WORLD_SLUG,
  normalizeDeepSeekModel,
  normalizeMinimumReplyLength,
} from "@/lib/config";
import { getAdapter } from "@/lib/ai";
import { buildNarrativePrompts, buildStateUpdatePrompts } from "@/lib/prompt";
import {
  mergeCharacterRuntimeState,
  normalizeCharacterRuntimeState,
  serializeCharacterRuntimeState,
  type CharacterRuntimeState,
  type CharacterRuntimeStateUpdate,
} from "@/lib/character-runtime-state";
import { ensureDatabaseSchema, prisma } from "@/lib/prisma";
import {
  applyMetricDeltas,
  buildInitialMetricRecord,
  normalizeStatusMetrics,
  syncMetricRecord,
  type StatusMetricDefinition,
} from "@/lib/status-metrics";
import { hiddenStateUpdateSchema, type HiddenStateUpdate } from "@/lib/story-schema";
import {
  DEFAULT_DIRECTOR_CONFIG,
  DEFAULT_PLAYER_PROFILE,
  normalizeDirectorConfig,
  normalizePlayerProfile,
  type DirectorConfig,
  type PlayerProfile,
} from "@/lib/story-director";
import { pickSuggestedPrompts } from "@/lib/suggested-prompts";

type CharacterView = {
  id: string;
  slug: string;
  name: string;
  gender: string;
  roleLabel: string;
  publicSummary: string;
  secretSummary: string;
  personalityTags: string[];
  initialMetrics: Record<string, number>;
  runtimeState: CharacterRuntimeState;
};

type MessageView = {
  id: string;
  role: MessageRole;
  content: string;
  turnNumber: number;
  createdAt: string;
};

type RelationshipView = {
  id: string;
  characterId: string;
  metrics: Record<string, number>;
  dynamicProfile: CharacterRuntimeState;
  note: string | null;
  character: {
    id: string;
    slug: string;
    name: string;
    gender: string;
  };
};

type SceneStateView = {
  currentScene: string;
  currentTime: string;
  atmosphere: string;
  summary: string;
  changes: string[];
  facts: string[];
};

type MemorySummaryView = {
  id: string;
  content: string;
  turnNumber: number;
  createdAt: string;
};

export type SessionWorld = {
  id: string;
  slug: string;
  name: string;
  description: string;
  premise: string;
  storyGuide: string;
  directorConfig: DirectorConfig;
};

export type SessionBundle = {
  id: string;
  title: string;
  provider: string;
  model: string;
  isSaved: boolean;
  world: SessionWorld;
  playerProfile: PlayerProfile;
  characters: CharacterView[];
  messages: MessageView[];
  relationships: RelationshipView[];
  sceneState: SceneStateView;
  memorySummaries: MemorySummaryView[];
  statusMetrics: StatusMetricDefinition[];
  suggestedPrompts: string[];
};

export type SessionListItem = {
  id: string;
  title: string;
  model: string;
  provider: string;
  updatedAt: string;
  worldId: string;
  isSaved: boolean;
};

export type WorldSaveItem = {
  id: string;
  title: string;
  model: string;
  updatedAt: string;
  turnCount: number;
};

export type WorldCharacterItem = {
  id: string;
  name: string;
  gender: string;
  roleLabel: string;
  publicSummary: string;
};

export type WorldCardItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  premise: string;
  defaultScene: string;
  directorConfig: DirectorConfig;
  playerProfileTemplate: PlayerProfile;
  characterCount: number;
  characters: WorldCharacterItem[];
  savedSessions: WorldSaveItem[];
  updatedAt: string;
};

export type WorldSelectionData = {
  worlds: WorldCardItem[];
  availableModels: string[];
};

export type AppBootstrap = {
  world: SessionBundle["world"];
  sessions: SessionListItem[];
  activeSession: SessionBundle;
  availableModels: string[];
};

const sessionInclude = {
  world: {
    include: {
      characters: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
  messages: { orderBy: { createdAt: "asc" } },
  relationships: {
    include: { character: true },
    orderBy: { createdAt: "asc" },
  },
  memorySummaries: {
    orderBy: { createdAt: "desc" },
    take: 8,
  },
  sceneStates: {
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.SessionInclude;

function asNumberRecord(value: Prisma.JsonValue | null | undefined): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, inner] of Object.entries(value)) {
    if (typeof inner === "number") result[key] = inner;
  }
  return result;
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asHiddenStateUpdate(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = hiddenStateUpdateSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mapSessionListItem(item: {
  id: string;
  title: string;
  model: string;
  provider: string;
  updatedAt: Date;
  worldId: string;
  isSaved: boolean;
}): SessionListItem {
  return {
    id: item.id,
    title: item.title,
    model: normalizeDeepSeekModel(item.model),
    provider: item.provider,
    updatedAt: item.updatedAt.toISOString(),
    worldId: item.worldId,
    isSaved: item.isSaved,
  };
}

function buildSuggestedPrompts(params: {
  latestScene: SceneStateView;
  characters: CharacterView[];
  lastAssistantUpdate: HiddenStateUpdate | null;
}) {
  return pickSuggestedPrompts({
    fromModel: params.lastAssistantUpdate?.suggestedActions,
    scene: params.latestScene.currentScene,
    atmosphere: params.latestScene.atmosphere,
    characterNames: params.characters.map((character) => character.name),
  });
}

function mapSession(session: Prisma.SessionGetPayload<{ include: typeof sessionInclude }>): SessionBundle {
  const statusMetrics = normalizeStatusMetrics(session.world.statusMetrics);
  const relationshipsByCharacterId = new Map(session.relationships.map((item) => [item.characterId, item]));
  const latestSceneRecord = session.sceneStates[0];
  const sceneState: SceneStateView = {
    currentScene: latestSceneRecord?.currentScene || session.world.defaultScene,
    currentTime: latestSceneRecord?.currentTime || session.world.defaultTime,
    atmosphere: latestSceneRecord?.atmosphere || "neutral and cautious",
    summary: latestSceneRecord?.summary || session.world.defaultScene,
    changes: asStringArray(latestSceneRecord?.changes),
    facts: asStringArray(latestSceneRecord?.facts),
  };
  const characters = session.world.characters.map((character) => ({
    id: character.id,
    slug: character.slug,
    name: character.name,
    gender: character.gender,
    roleLabel: character.roleLabel,
    publicSummary: character.publicSummary,
    secretSummary: character.secretSummary,
    personalityTags: asStringArray(character.personalityTags),
    initialMetrics: asNumberRecord(character.initialMetrics),
    runtimeState: normalizeCharacterRuntimeState(relationshipsByCharacterId.get(character.id)?.dynamicProfile),
  }));
  const latestAssistantMessage = [...session.messages].reverse().find((message) => message.role === MessageRole.ASSISTANT);

  return {
    id: session.id,
    title: session.title,
    provider: session.provider,
    model: normalizeDeepSeekModel(session.model),
    isSaved: session.isSaved,
    statusMetrics,
    world: {
      id: session.world.id,
      slug: session.world.slug,
      name: session.world.name,
      description: session.world.description,
      premise: session.world.premise,
      storyGuide: session.world.storyGuide,
      directorConfig: normalizeDirectorConfig(session.world.directorConfig),
    },
    playerProfile: normalizePlayerProfile(session.playerProfile),
    characters,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      turnNumber: message.turnNumber,
      createdAt: message.createdAt.toISOString(),
    })),
    relationships: session.relationships.map((item) => ({
      id: item.id,
      characterId: item.characterId,
      metrics: syncMetricRecord(statusMetrics, asNumberRecord(item.metrics)),
      dynamicProfile: normalizeCharacterRuntimeState(item.dynamicProfile),
      note: item.note,
      character: {
        id: item.character.id,
        slug: item.character.slug,
        name: item.character.name,
        gender: item.character.gender,
      },
    })),
    sceneState,
    memorySummaries: [...session.memorySummaries].reverse().map((item) => ({
      id: item.id,
      content: item.content,
      turnNumber: item.turnNumber,
      createdAt: item.createdAt.toISOString(),
    })),
    suggestedPrompts: buildSuggestedPrompts({
      latestScene: sceneState,
      characters,
      lastAssistantUpdate: asHiddenStateUpdate(latestAssistantMessage?.metadata),
    }),
  };
}

async function getDefaultWorld() {
  const world = await prisma.world.findFirst({
    where: { slug: DEFAULT_WORLD_SLUG },
    orderBy: { createdAt: "asc" },
  });
  if (world) return world;
  const fallback = await prisma.world.findFirst({ orderBy: { createdAt: "asc" } });
  if (!fallback) throw new Error("No world data. Run seed first.");
  return fallback;
}

async function createSession(worldId: string, model = DEFAULT_DEEPSEEK_MODEL, isSaved = false) {
  const normalizedModel = normalizeDeepSeekModel(model);
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: { characters: { orderBy: { createdAt: "asc" } } },
  });
  if (!world) throw new Error("World does not exist.");
  const statusMetrics = normalizeStatusMetrics(world.statusMetrics);

  const session = await prisma.session.create({
    data: {
      worldId: world.id,
      title: "New encounter",
      provider: "deepseek",
      model: normalizedModel,
      isSaved,
      playerProfile: DEFAULT_PLAYER_PROFILE as unknown as Prisma.InputJsonValue,
      relationships: {
        create: world.characters.map((character) => ({
          character: { connect: { id: character.id } },
          metrics: syncMetricRecord(statusMetrics, asNumberRecord(character.initialMetrics)) as Prisma.InputJsonValue,
          dynamicProfile: serializeCharacterRuntimeState(normalizeCharacterRuntimeState(null)),
        })),
      },
      memorySummaries: { create: { turnNumber: 0, content: world.initialMemory } },
      sceneStates: {
        create: {
          turnNumber: 0,
          currentScene: world.defaultScene,
          currentTime: world.defaultTime,
          atmosphere: "neutral and cautious",
          summary: world.defaultScene,
          changes: [],
          facts: [],
        },
      },
    },
    include: sessionInclude,
  });

  return mapSession(session);
}

export async function getWorldSelectionData(): Promise<WorldSelectionData> {
  await ensureDatabaseSchema();
  const worlds = await prisma.world.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      characters: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, gender: true, roleLabel: true, publicSummary: true },
      },
      sessions: {
        where: { isSaved: true },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, model: true, updatedAt: true, turnCount: true },
      },
    },
  });

  return {
    worlds: worlds.map((world) => ({
      id: world.id,
      slug: world.slug,
      name: world.name,
      description: world.description,
      premise: world.premise,
      defaultScene: world.defaultScene,
      directorConfig: normalizeDirectorConfig(world.directorConfig),
      playerProfileTemplate: { ...DEFAULT_PLAYER_PROFILE },
      characterCount: world.characters.length,
      characters: world.characters.map((character) => ({
        id: character.id,
        name: character.name,
        gender: character.gender,
        roleLabel: character.roleLabel,
        publicSummary: character.publicSummary,
      })),
      savedSessions: world.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        model: normalizeDeepSeekModel(session.model),
        updatedAt: session.updatedAt.toISOString(),
        turnCount: session.turnCount,
      })),
      updatedAt: world.updatedAt.toISOString(),
    })),
    availableModels: AVAILABLE_DEEPSEEK_MODELS,
  };
}

function buildSlug(value: string, fallback: string) {
  const base = value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
  return `${base}_${Date.now().toString(36)}`;
}

export async function createWorldCard(input: { name?: string; description?: string; premise?: string; defaultScene?: string }) {
  await ensureDatabaseSchema();
  const name = input.name?.trim() || "New world";
  await prisma.world.create({
    data: {
      slug: buildSlug(name, "world"),
      name,
      description: input.description?.trim() || "A new interactive story world.",
      premise: input.premise?.trim() || "The player enters a new story and begins building relationships.",
      storyGuide: "Focus on romance narrative, relationships, emotion, and scene progression.",
      defaultScene: input.defaultScene?.trim() || "A quiet room before the story begins.",
      defaultTime: "Day 1, evening",
      initialMemory: "The player has just entered this world.",
      directorConfig: DEFAULT_DIRECTOR_CONFIG as unknown as Prisma.InputJsonValue,
      statusMetrics: [
        { key: "trust", label: "Trust", max: 10 },
        { key: "affection", label: "Affection", max: 10 },
        { key: "tension", label: "Tension", max: 10 },
        { key: "curiosity", label: "Curiosity", max: 10 },
      ],
      characters: {
        create: [
          {
            slug: "role_a",
            name: "New Character",
            gender: "Unknown",
            roleLabel: "Main character",
            publicSummary: "This character needs a public profile.",
            secretSummary: "This character needs hidden motives.",
            personalityTags: ["Unset"],
            initialMetrics: { trust: 0, affection: 0, tension: 0, curiosity: 0 },
          },
        ],
      },
    },
  });
  return getWorldSelectionData();
}

export async function getAppBootstrap(activeSessionId?: string | null): Promise<AppBootstrap> {
  await ensureDatabaseSchema();
  const requestedSession = activeSessionId
    ? await prisma.session.findUnique({ where: { id: activeSessionId }, include: sessionInclude })
    : null;
  const fallbackWorld = requestedSession ? null : await getDefaultWorld();
  const activeSession = requestedSession ? mapSession(requestedSession) : await createSession(fallbackWorld!.id);
  const sessions = await prisma.session.findMany({
    where: { worldId: activeSession.world.id },
    orderBy: { updatedAt: "desc" },
  });
  return {
    world: activeSession.world,
    sessions: sessions.map(mapSessionListItem),
    activeSession,
    availableModels: AVAILABLE_DEEPSEEK_MODELS,
  };
}

export async function listSessions(worldId?: string) {
  await ensureDatabaseSchema();
  const resolvedWorldId = worldId || (await getDefaultWorld()).id;
  const sessions = await prisma.session.findMany({ where: { worldId: resolvedWorldId }, orderBy: { updatedAt: "desc" } });
  return sessions.map(mapSessionListItem);
}

export async function createNewSession(input: string | { model?: string; worldId?: string; isSaved?: boolean } = DEFAULT_DEEPSEEK_MODEL) {
  await ensureDatabaseSchema();
  const model = typeof input === "string" ? input : input.model || DEFAULT_DEEPSEEK_MODEL;
  const worldId = typeof input === "string" ? undefined : input.worldId;
  const isSaved = typeof input === "string" ? false : input.isSaved ?? false;
  const world = worldId ? await prisma.world.findUnique({ where: { id: worldId } }) : await getDefaultWorld();
  if (!world) throw new Error("World does not exist.");
  const session = await createSession(world.id, model, isSaved);
  return { session, sessions: await listSessions(world.id) };
}

export async function saveSessionById(sessionId: string) {
  await ensureDatabaseSchema();
  const session = await prisma.session.update({ where: { id: sessionId }, data: { isSaved: true }, include: sessionInclude });
  return { session: mapSession(session), sessions: await listSessions(session.worldId) };
}

export async function getSessionDetail(sessionId: string) {
  await ensureDatabaseSchema();
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: sessionInclude });
  if (!session) throw new Error("Session does not exist.");
  return mapSession(session);
}

export async function updateWorldSettings(
  worldId: string,
  input: {
    name?: string;
    description?: string;
    premise?: string;
    storyGuide?: string;
    statusMetrics?: StatusMetricDefinition[];
    directorConfig?: DirectorConfig;
  },
) {
  await ensureDatabaseSchema();
  const normalizedMetrics = input.statusMetrics === undefined ? undefined : normalizeStatusMetrics(input.statusMetrics);
  const normalizedDirectorConfig = input.directorConfig === undefined ? undefined : normalizeDirectorConfig(input.directorConfig);
  const world = await prisma.world.update({
    where: { id: worldId },
    data: {
      name: input.name?.trim(),
      description: input.description?.trim(),
      premise: input.premise?.trim(),
      storyGuide: input.storyGuide?.trim(),
      statusMetrics: normalizedMetrics as Prisma.InputJsonValue | undefined,
      directorConfig: normalizedDirectorConfig as Prisma.InputJsonValue | undefined,
    },
  });

  if (normalizedMetrics !== undefined) {
    const relationshipStates = await prisma.relationshipState.findMany({
      where: { session: { worldId } },
      select: { id: true, metrics: true },
    });
    await prisma.$transaction(
      relationshipStates.map((state) =>
        prisma.relationshipState.update({
          where: { id: state.id },
          data: { metrics: syncMetricRecord(normalizedMetrics, asNumberRecord(state.metrics)) as Prisma.InputJsonValue },
        }),
      ),
    );
  }

  return {
    id: world.id,
    slug: world.slug,
    name: world.name,
    description: world.description,
    premise: world.premise,
    storyGuide: world.storyGuide,
    statusMetrics: normalizeStatusMetrics(world.statusMetrics),
    directorConfig: normalizeDirectorConfig(world.directorConfig),
  };
}

export async function updatePlayerProfile(sessionId: string, playerProfile: PlayerProfile) {
  await ensureDatabaseSchema();
  await prisma.session.update({
    where: { id: sessionId },
    data: { playerProfile: normalizePlayerProfile(playerProfile) as unknown as Prisma.InputJsonValue },
  });
  return getSessionDetail(sessionId);
}

export async function updateSessionModel(sessionId: string, model: string) {
  await ensureDatabaseSchema();
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: { model: normalizeDeepSeekModel(model) },
    include: sessionInclude,
  });
  return mapSession(session);
}

export async function updateCharacterSettings(characterId: string, input: { name?: string; gender?: string; roleLabel?: string; publicSummary?: string; secretSummary?: string; personalityTags?: string[] }) {
  await ensureDatabaseSchema();
  const character = await prisma.character.update({
    where: { id: characterId },
    data: {
      name: input.name?.trim(),
      gender: input.gender?.trim(),
      roleLabel: input.roleLabel?.trim(),
      publicSummary: input.publicSummary?.trim(),
      secretSummary: input.secretSummary?.trim(),
      personalityTags: input.personalityTags as Prisma.InputJsonValue | undefined,
    },
  });
  return {
    id: character.id,
    slug: character.slug,
    name: character.name,
    gender: character.gender,
    roleLabel: character.roleLabel,
    publicSummary: character.publicSummary,
    secretSummary: character.secretSummary,
    personalityTags: asStringArray(character.personalityTags),
  };
}

export async function updateCharacterRuntimeState(input: { sessionId: string; characterId: string; runtimeState: CharacterRuntimeStateUpdate }) {
  await ensureDatabaseSchema();
  const relationship = await prisma.relationshipState.findUnique({
    where: { sessionId_characterId: { sessionId: input.sessionId, characterId: input.characterId } },
  });
  if (!relationship) throw new Error("Character state does not exist in this session.");

  const current = normalizeCharacterRuntimeState(relationship.dynamicProfile);
  const merged = mergeCharacterRuntimeState(current, input.runtimeState, "PLAYER");
  await prisma.relationshipState.update({
    where: { id: relationship.id },
    data: { dynamicProfile: serializeCharacterRuntimeState(merged) },
  });

  return getSessionDetail(input.sessionId);
}

export async function createCharacterForWorld(input: { worldId: string; sessionId: string; name?: string; gender?: string; roleLabel?: string; publicSummary?: string; secretSummary?: string; personalityTags?: string[] }) {
  await ensureDatabaseSchema();
  const world = await prisma.world.findUnique({ where: { id: input.worldId } });
  if (!world) throw new Error("World does not exist.");
  const statusMetrics = normalizeStatusMetrics(world.statusMetrics);
  const initialMetrics = buildInitialMetricRecord(statusMetrics);
  const name = input.name?.trim() || "New Character";
  const character = await prisma.character.create({
    data: {
      worldId: world.id,
      slug: buildSlug(name, "character"),
      name,
      gender: input.gender?.trim() || "Unknown",
      roleLabel: input.roleLabel?.trim() || "Main character",
      publicSummary: input.publicSummary?.trim() || "This character needs a public profile.",
      secretSummary: input.secretSummary?.trim() || "This character needs hidden motives.",
      personalityTags: (input.personalityTags ?? []) as Prisma.InputJsonValue,
      initialMetrics: initialMetrics as Prisma.InputJsonValue,
    },
  });
  const sessions = await prisma.session.findMany({ where: { worldId: world.id }, select: { id: true } });
  await prisma.$transaction(
    sessions.map((session) =>
      prisma.relationshipState.create({
        data: {
          sessionId: session.id,
          characterId: character.id,
          metrics: initialMetrics as Prisma.InputJsonValue,
          dynamicProfile: serializeCharacterRuntimeState(normalizeCharacterRuntimeState(null)),
        },
      }),
    ),
  );
  return getSessionDetail(input.sessionId);
}

export async function deleteCharacterById(characterId: string, sessionId: string) {
  await ensureDatabaseSchema();
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character) throw new Error("Character does not exist.");
  const characterCount = await prisma.character.count({ where: { worldId: character.worldId } });
  if (characterCount <= 1) throw new Error("At least one character must remain.");
  await prisma.character.delete({ where: { id: characterId } });
  return getSessionDetail(sessionId);
}

export async function deleteSessionById(sessionId: string, options?: { hydrateNextSession?: boolean }) {
  await ensureDatabaseSchema();
  const target = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!target) throw new Error("Session does not exist.");
  await prisma.session.delete({ where: { id: sessionId } });
  const remainingSessions = await prisma.session.findMany({ where: { worldId: target.worldId }, orderBy: { updatedAt: "desc" } });
  const shouldHydrateNextSession = options?.hydrateNextSession ?? true;
  let nextSession: SessionBundle | null = null;
  if (shouldHydrateNextSession) {
    nextSession = remainingSessions[0] ? await getSessionDetail(remainingSessions[0].id) : await createSession(target.worldId);
  }
  return { deletedSessionId: sessionId, nextSession, sessions: await listSessions(target.worldId) };
}

function computeRelationshipUpdates(
  relationships: RelationshipView[],
  characters: CharacterView[],
  statusMetrics: StatusMetricDefinition[],
  changes: HiddenStateUpdate["relationshipChanges"],
) {
  const byCharacterId = new Map(relationships.map((item) => [item.characterId, { ...item.metrics }]));
  for (const [compoundKey, delta] of Object.entries(changes)) {
    const matchedCharacter = characters.find((character) => compoundKey.startsWith(`${character.slug}_`));
    if (!matchedCharacter) continue;
    const metricName = compoundKey.slice(matchedCharacter.slug.length + 1);
    const current = byCharacterId.get(matchedCharacter.id) || {};
    byCharacterId.set(matchedCharacter.id, applyMetricDeltas(statusMetrics, current, { [metricName]: delta }));
  }
  return relationships.map((relationship) => ({
    relationshipId: relationship.id,
    characterId: relationship.characterId,
    metrics: byCharacterId.get(relationship.characterId) || relationship.metrics,
  }));
}

function computeCharacterRuntimeUpdates(relationships: RelationshipView[], characters: CharacterView[], changes: HiddenStateUpdate["characterStateUpdates"]) {
  return relationships.map((relationship) => {
    const character = characters.find((item) => item.id === relationship.characterId);
    const update = character ? changes[character.slug] : undefined;
    return {
      relationshipId: relationship.id,
      dynamicProfile: update ? mergeCharacterRuntimeState(relationship.dynamicProfile, update, "AI") : relationship.dynamicProfile,
    };
  });
}

function buildSceneSnapshot(bundle: SessionBundle, turnNumber: number, update: HiddenStateUpdate) {
  return {
    turnNumber,
    currentScene: update.currentScene || bundle.sceneState.currentScene,
    currentTime: update.currentTime || bundle.sceneState.currentTime,
    atmosphere: update.atmosphere || update.sceneChanges.at(-1) || bundle.sceneState.atmosphere,
    summary: update.memorySummary || update.sceneChanges.join("; ") || bundle.sceneState.summary,
    changes: update.sceneChanges,
    facts: update.newFacts,
  };
}

function buildSessionTitle(previousTitle: string, userMessage: string, turnNumber: number) {
  if (turnNumber !== 1 || previousTitle !== "New encounter") return previousTitle;
  return userMessage.slice(0, 18) || previousTitle;
}

export async function sendTurn(params: { sessionId: string; content: string; model?: string; apiKey?: string; minimumReplyLength?: number }) {
  await ensureDatabaseSchema();
  const bundle = await getSessionDetail(params.sessionId);
  const adapter = getAdapter(bundle.provider);
  const model = normalizeDeepSeekModel(params.model || bundle.model || DEFAULT_DEEPSEEK_MODEL);
  const minimumReplyLength = normalizeMinimumReplyLength(params.minimumReplyLength ?? DEFAULT_MINIMUM_REPLY_LENGTH);
  const narrativePrompts = buildNarrativePrompts(bundle, params.content, { minimumReplyLength });
  const visibleReply = await adapter.generateVisibleReply({
    model,
    systemPrompt: narrativePrompts.systemPrompt,
    userPrompt: narrativePrompts.userPrompt,
    apiKey: params.apiKey,
    minimumReplyLength,
  });
  const statePrompts = buildStateUpdatePrompts(bundle, params.content, visibleReply);
  const hiddenStateUpdate = await adapter.generateStateUpdate({
    model,
    systemPrompt: statePrompts.systemPrompt,
    userPrompt: statePrompts.userPrompt,
    apiKey: params.apiKey,
  });
  const generated = { visibleReply, hiddenStateUpdate };
  const turnNumber = bundle.messages.at(-1)?.turnNumber ? bundle.messages.at(-1)!.turnNumber + 1 : 1;
  const relationshipUpdates = computeRelationshipUpdates(bundle.relationships, bundle.characters, bundle.statusMetrics, generated.hiddenStateUpdate.relationshipChanges);
  const characterRuntimeUpdates = computeCharacterRuntimeUpdates(bundle.relationships, bundle.characters, generated.hiddenStateUpdate.characterStateUpdates);
  const sceneSnapshot = buildSceneSnapshot(bundle, turnNumber, generated.hiddenStateUpdate);

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.message.createMany({
      data: [
        { sessionId: bundle.id, role: MessageRole.USER, turnNumber, content: params.content },
        { sessionId: bundle.id, role: MessageRole.ASSISTANT, turnNumber, content: generated.visibleReply, metadata: generated.hiddenStateUpdate as unknown as Prisma.InputJsonValue },
      ],
    }),
    ...relationshipUpdates.map((relationship) =>
      prisma.relationshipState.update({ where: { id: relationship.relationshipId }, data: { metrics: relationship.metrics as Prisma.InputJsonValue } }),
    ),
    ...characterRuntimeUpdates.map((relationship) =>
      prisma.relationshipState.update({ where: { id: relationship.relationshipId }, data: { dynamicProfile: serializeCharacterRuntimeState(relationship.dynamicProfile) } }),
    ),
    prisma.sceneState.create({
      data: {
        sessionId: bundle.id,
        turnNumber,
        currentScene: sceneSnapshot.currentScene,
        currentTime: sceneSnapshot.currentTime,
        atmosphere: sceneSnapshot.atmosphere,
        summary: sceneSnapshot.summary,
        changes: sceneSnapshot.changes as Prisma.InputJsonValue,
        facts: sceneSnapshot.facts as Prisma.InputJsonValue,
      },
    }),
    prisma.session.update({
      where: { id: bundle.id },
      data: {
        model,
        turnCount: turnNumber,
        title: buildSessionTitle(bundle.title, params.content, turnNumber),
      },
    }),
  ];

  if (generated.hiddenStateUpdate.memorySummary) {
    writes.push(prisma.memorySummary.create({ data: { sessionId: bundle.id, turnNumber, content: generated.hiddenStateUpdate.memorySummary } }));
  }

  await prisma.$transaction(writes);
  const updatedSession = await getSessionDetail(bundle.id);
  return { session: updatedSession, generated, sessions: await listSessions(updatedSession.world.id) };
}
