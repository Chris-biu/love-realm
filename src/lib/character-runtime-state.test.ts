import assert from "node:assert/strict";
import test from "node:test";
import { mergeCharacterRuntimeState, normalizeCharacterRuntimeState } from "./character-runtime-state";

test("AI updates do not override player locked text fields", () => {
  const current = normalizeCharacterRuntimeState({
    currentIdentity: { value: "Player's lover", source: "PLAYER" },
    currentRelationship: { value: "Lovers", source: "PLAYER" },
    attitudeTowardPlayer: { value: "Warm but guarded", source: "AI" },
    playerAddress: { value: "you", source: "AI" },
    persistentFacts: {
      value: ["She accepted the player's confession."],
      source: "PLAYER",
    },
  });

  const merged = mergeCharacterRuntimeState(current, {
    currentIdentity: "Rival",
    currentRelationship: "Enemies",
    attitudeTowardPlayer: "Hostile again",
    playerAddress: "intruder",
    persistentFacts: ["She only sees the player as an enemy."],
  });

  assert.equal(merged.currentIdentity.value, "Player's lover");
  assert.equal(merged.currentRelationship.value, "Lovers");
  assert.equal(merged.attitudeTowardPlayer.value, "Hostile again");
  assert.equal(merged.playerAddress.value, "intruder");
});

test("player-edited persistent facts remain protected but AI can still append new facts", () => {
  const current = normalizeCharacterRuntimeState({
    persistentFacts: {
      value: ["The player now knows her real surname."],
      source: "PLAYER",
    },
  });

  const merged = mergeCharacterRuntimeState(current, {
    persistentFacts: {
      standard: [
        "She keeps the old brass key in her coat pocket.",
        "The player now knows her real surname.",
      ],
    },
  });

  assert.deepEqual(merged.persistentFacts.standard, [
    "The player now knows her real surname.",
    "She keeps the old brass key in her coat pocket.",
  ]);
});

test("manual character runtime state is marked as player sourced", () => {
  const merged = mergeCharacterRuntimeState(
    normalizeCharacterRuntimeState(null),
    {
      currentIdentity: "Player's lover",
      currentRelationship: "Lovers",
      attitudeTowardPlayer: "Affectionate but competitive",
      playerAddress: "dear",
      persistentFacts: { standard: ["She turned from rival to lover."] },
    },
    "PLAYER",
  );

  assert.equal(merged.currentIdentity.source, "PLAYER");
  assert.equal(merged.currentRelationship.source, "PLAYER");
  assert.equal(merged.persistentFacts.source, "PLAYER");
});

test("legacy persistent facts are migrated into standard-priority facts", () => {
  const normalized = normalizeCharacterRuntimeState({
    persistentFacts: {
      value: ["The player knows her real surname."],
      source: "PLAYER",
    },
  });

  assert.deepEqual(normalized.persistentFacts.highPriority, []);
  assert.deepEqual(normalized.persistentFacts.standard, ["The player knows her real surname."]);
  assert.equal(normalized.persistentFacts.source, "PLAYER");
});

test("player-edited high-priority facts stay protected while ai appends standard facts", () => {
  const current = normalizeCharacterRuntimeState({
    persistentFacts: {
      highPriority: ["She accepted the player's confession."],
      standard: ["She hides a brass key in her coat pocket."],
      source: "PLAYER",
    },
  });

  const merged = mergeCharacterRuntimeState(current, {
    persistentFacts: {
      highPriority: ["She betrayed the player."],
      standard: [
        "She hides a brass key in her coat pocket.",
        "She avoids the music room after midnight.",
      ],
    },
  });

  assert.deepEqual(merged.persistentFacts.highPriority, ["She accepted the player's confession."]);
  assert.deepEqual(merged.persistentFacts.standard, [
    "She hides a brass key in her coat pocket.",
    "She avoids the music room after midnight.",
  ]);
});
