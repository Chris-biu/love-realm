import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MINIMUM_REPLY_LENGTH } from "./config";
import { buildNarrativePrompts, buildStateUpdatePrompts } from "./prompt";
import type { SessionBundle } from "./session-service";

const bundle = {
  id: "session-1",
  provider: "deepseek",
  model: "deepseek-v4-flash",
  title: "Test",
  isSaved: false,
  world: {
    id: "world-1",
    slug: "test-world",
    name: "Test World",
    description: "A contained test world.",
    premise: "A player meets two characters.",
    storyGuide: "Write immersive interactive fiction.",
    directorConfig: {
      pacing: "slow",
      beatLabel: "slow-burn romance",
      retrieval: {
        memoryLimit: 2,
        factLimit: 2,
        dialogueLimit: 2,
      },
    },
  },
  playerProfile: {
    displayName: "Aster",
    role: "new manager",
    publicPersona: "calm, observant, and slow to trust",
    background: "Returned after years away from the coast.",
    motivation: "Find out why the former manager vanished.",
    speakingStyle: "Speaks softly but asks very precise questions.",
  },
  statusMetrics: [{ key: "trust", label: "Trust", max: 20 }],
  memorySummaries: [
    {
      id: "memory-1",
      content: "Lin Yue noticed the player hiding a wet envelope.",
      turnNumber: 2,
      createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    },
    {
      id: "memory-2",
      content: "The brass key opens the locked music room.",
      turnNumber: 3,
      createdAt: new Date("2026-01-01T11:00:00Z").toISOString(),
    },
  ],
  messages: [
    {
      id: "message-1",
      role: "USER",
      content: "I ask about the key.",
      turnNumber: 1,
      createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    },
    {
      id: "message-2",
      role: "ASSISTANT",
      content: "Lin Yue looks at the brass key before answering.",
      turnNumber: 1,
      createdAt: new Date("2026-01-01T10:00:30Z").toISOString(),
    },
  ],
  characters: [
    {
      id: "character-1",
      slug: "lin_yue",
      name: "Lin Yue",
      gender: "female",
      roleLabel: "Lead",
      publicSummary: "Calm and observant.",
      secretSummary: "Tests whether the player is sincere.",
      personalityTags: ["reserved"],
      initialMetrics: { trust: 5 },
      runtimeState: {
        currentIdentity: { value: "Player's girlfriend", source: "PLAYER" },
        currentRelationship: { value: "Lovers", source: "PLAYER" },
        attitudeTowardPlayer: { value: "Warm but guarded", source: "AI" },
        playerAddress: { value: "dear", source: "PLAYER" },
        persistentFacts: {
          value: ["She accepted the player's confession."],
          source: "PLAYER",
        },
      },
    },
  ],
  relationships: [
    {
      id: "relationship-1",
      characterId: "character-1",
      metrics: { trust: 5 },
      dynamicProfile: {
        currentIdentity: { value: "Player's girlfriend", source: "PLAYER" },
        currentRelationship: { value: "Lovers", source: "PLAYER" },
        attitudeTowardPlayer: { value: "Warm but guarded", source: "AI" },
        playerAddress: { value: "dear", source: "PLAYER" },
        persistentFacts: {
          value: ["She accepted the player's confession."],
          source: "PLAYER",
        },
      },
      note: null,
      character: {
        id: "character-1",
        slug: "lin_yue",
        name: "Lin Yue",
        gender: "female",
      },
    },
  ],
  sceneState: {
    currentScene: "The dim upstairs corridor",
    currentTime: "Night",
    atmosphere: "Quiet and suspicious",
    summary: "The player and Lin Yue stop outside the locked music room.",
    changes: ["They stopped in front of the locked music room."],
    facts: ["The brass key feels warm in the player's palm."],
  },
  suggestedPrompts: [],
} satisfies SessionBundle;

test("narrative prompt asks for plain long-form prose instead of JSON", () => {
  const prompts = buildNarrativePrompts(bundle, "Ask Lin Yue about the brass key.", {
    minimumReplyLength: 3000,
  });

  assert.match(prompts.systemPrompt, /JSON/i);
  assert.match(prompts.systemPrompt, /3000/);
  assert.doesNotMatch(prompts.systemPrompt, /hiddenStateUpdate/);
});

test("default minimum reply length is lighter for normal play", () => {
  assert.equal(DEFAULT_MINIMUM_REPLY_LENGTH, 800);
});

test("narrative prompt includes the player-defined protagonist profile", () => {
  const prompts = buildNarrativePrompts(bundle, "Ask Lin Yue about the brass key.");

  assert.match(prompts.userPrompt, /Aster/);
  assert.match(prompts.userPrompt, /new manager/);
  assert.match(prompts.userPrompt, /Find out why the former manager vanished/);
});

test("narrative prompt exposes pacing and per-metric max values", () => {
  const prompts = buildNarrativePrompts(bundle, "Ask Lin Yue about the brass key.");

  assert.match(prompts.userPrompt, /Trust/);
  assert.match(prompts.userPrompt, /max=20/);
  assert.match(prompts.systemPrompt, /slow-burn romance/);
});

test("prompt injects retrieved context related to the latest input", () => {
  const prompts = buildNarrativePrompts(bundle, "Ask Lin Yue whether the brass key opens the music room.");

  assert.match(prompts.userPrompt, /brass key opens the locked music room/i);
  assert.match(prompts.userPrompt, /Lin Yue looks at the brass key before answering/i);
});

test("state update prompt asks for compact JSON after the visible reply exists", () => {
  const prompts = buildStateUpdatePrompts(
    bundle,
    "Ask Lin Yue about the brass key.",
    "Lin Yue studies the key in silence before she answers.",
  );

  assert.match(prompts.systemPrompt, /JSON/i);
  assert.match(prompts.userPrompt, /Lin Yue studies the key/);
  assert.match(prompts.systemPrompt, /hiddenStateUpdate/);
});

test("state update prompt keeps manual character fields protected while allowing updates", () => {
  const prompts = buildStateUpdatePrompts(
    bundle,
    "Ask Lin Yue about the brass key.",
    "Lin Yue studies the key in silence before she answers.",
  );

  assert.match(prompts.systemPrompt, /PLAYER/);
  assert.match(prompts.systemPrompt, /persistentFacts/);
});
