import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MINIMUM_REPLY_LENGTH } from "./config";
import { buildNarrativePrompts, buildStateUpdatePrompts } from "./prompt";
import type { SessionBundle } from "./session-service";

const bundle = {
  id: "session-1",
  provider: "deepseek",
  model: "deepseek-chat",
  title: "Test",
  turnCount: 0,
  world: {
    id: "world-1",
    name: "Test World",
    description: "A contained test world.",
    premise: "A player meets two characters.",
    storyGuide: "Write immersive interactive fiction.",
  },
  statusMetrics: [{ key: "trust", label: "Trust" }],
  memorySummaries: [],
  messages: [],
  characters: [
    {
      id: "character-1",
      worldId: "world-1",
      name: "Lin Yue",
      slug: "lin_yue",
      gender: "female",
      roleLabel: "Lead",
      publicSummary: "Calm and observant.",
      secretSummary: "Tests whether the player is sincere.",
      personalityTags: ["reserved"],
    },
  ],
  relationships: [
    {
      id: "relationship-1",
      sessionId: "session-1",
      characterId: "character-1",
      character: {
        id: "character-1",
        worldId: "world-1",
        name: "Lin Yue",
        slug: "lin_yue",
        gender: "female",
        roleLabel: "Lead",
        publicSummary: "Calm and observant.",
        secretSummary: "Tests whether the player is sincere.",
        personalityTags: ["reserved"],
      },
      metrics: { trust: 5 },
    },
  ],
  sceneState: {
    id: "scene-1",
    sessionId: "session-1",
    turnNumber: 0,
    currentScene: "Bedroom",
    currentTime: "Night",
    atmosphere: "Tense",
    summary: "The player enters the room.",
    changes: [],
    facts: [],
  },
} satisfies SessionBundle;

test("narrative prompt asks for plain long-form prose instead of JSON", () => {
  const prompts = buildNarrativePrompts(bundle, "Approach Lin Yue.", { minimumReplyLength: 3000 });

  assert.match(prompts.systemPrompt, /不要输出 JSON/);
  assert.match(prompts.systemPrompt, /不少于 3000/);
  assert.doesNotMatch(prompts.systemPrompt, /hiddenStateUpdate/);
});

test("default minimum reply length is lighter for normal play", () => {
  assert.equal(DEFAULT_MINIMUM_REPLY_LENGTH, 800);
});

test("narrative prompt constrains important characters to the character cards", () => {
  const prompts = buildNarrativePrompts(bundle, "Approach Lin Yue.");

  assert.match(prompts.systemPrompt, /不得新增重要角色/);
  assert.match(prompts.userPrompt, /Lin Yue/);
  assert.match(prompts.userPrompt, /lin_yue/);
});

test("state update prompt asks for compact JSON after the final visible reply exists", () => {
  const prompts = buildStateUpdatePrompts(bundle, "Approach Lin Yue.", "Final narrative text.");

  assert.match(prompts.systemPrompt, /只输出严格 JSON/);
  assert.match(prompts.userPrompt, /Final narrative text/);
  assert.match(prompts.systemPrompt, /hiddenStateUpdate/);
});

test("state update prompt must not promote invented characters into memory", () => {
  const prompts = buildStateUpdatePrompts(bundle, "Approach Lin Yue.", "Final narrative text.");

  assert.match(prompts.systemPrompt, /不得把模型临时生成的无名背景人物写成重要人物/);
});
