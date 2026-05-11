import assert from "node:assert/strict";
import test from "node:test";
import { parseHiddenStateUpdate } from "./story-schema";

test("parses hidden state update without requiring the long visible reply", () => {
  const parsed = parseHiddenStateUpdate(
    JSON.stringify({
      relationshipChanges: {
        lin_yue_trust: 1,
      },
      sceneChanges: ["The room shifts from tense silence into a direct confrontation."],
      newFacts: ["Lin Yue noticed the player hesitated before answering."],
      memorySummary: "Lin Yue directly challenged the player about the previous night.",
      currentScene: "Moonlit bedroom",
      currentTime: "Late night",
      atmosphere: "Quiet pressure",
      suggestedActions: ["Explain honestly", "Stay silent", "Ask why she waited"],
    }),
  );

  assert.equal(parsed.suggestedActions.length, 3);
  assert.equal(parsed.relationshipChanges.lin_yue_trust, 1);
});

test("parses character runtime state updates from hidden state JSON", () => {
  const parsed = parseHiddenStateUpdate(
    JSON.stringify({
      relationshipChanges: {},
      sceneChanges: [],
      newFacts: [],
      memorySummary: "",
      suggestedActions: ["Continue", "Ask", "Observe"],
      characterStateUpdates: {
        lin_yue: {
          currentIdentity: "玩家的女朋友",
          currentRelationship: "恋人",
          attitudeTowardPlayer: "亲密但嘴硬",
          playerAddress: "亲爱的",
          persistentFacts: ["她已经接受玩家告白"],
        },
      },
    }),
  );

  assert.equal(parsed.characterStateUpdates.lin_yue.currentIdentity, "玩家的女朋友");
  assert.deepEqual(parsed.characterStateUpdates.lin_yue.persistentFacts, ["她已经接受玩家告白"]);
});
