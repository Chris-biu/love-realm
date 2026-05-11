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
