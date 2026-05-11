import assert from "node:assert/strict";
import test from "node:test";
import { mergeCharacterRuntimeState, normalizeCharacterRuntimeState } from "./character-runtime-state";

test("AI updates do not override player locked character runtime fields", () => {
  const current = normalizeCharacterRuntimeState({
    currentIdentity: { value: "玩家的女朋友", source: "PLAYER" },
    currentRelationship: { value: "恋人", source: "PLAYER" },
    attitudeTowardPlayer: { value: "亲密但嘴硬", source: "AI" },
    playerAddress: { value: "你", source: "AI" },
    persistentFacts: { value: ["她已经接受玩家告白"], source: "PLAYER" },
  });

  const merged = mergeCharacterRuntimeState(current, {
    currentIdentity: "死对头",
    currentRelationship: "敌对",
    attitudeTowardPlayer: "重新敌视玩家",
    playerAddress: "宿敌",
    persistentFacts: ["她仍然只把玩家当敌人"],
  });

  assert.equal(merged.currentIdentity.value, "玩家的女朋友");
  assert.equal(merged.currentRelationship.value, "恋人");
  assert.equal(merged.attitudeTowardPlayer.value, "重新敌视玩家");
  assert.equal(merged.playerAddress.value, "宿敌");
  assert.deepEqual(merged.persistentFacts.value, ["她已经接受玩家告白"]);
});

test("manual character runtime state is marked as player sourced", () => {
  const merged = mergeCharacterRuntimeState(normalizeCharacterRuntimeState(null), {
    currentIdentity: "玩家的女朋友",
    currentRelationship: "恋人",
    attitudeTowardPlayer: "亲密但保留竞争感",
    playerAddress: "亲爱的",
    persistentFacts: ["她已经从死对头转变为恋人"],
  }, "PLAYER");

  assert.equal(merged.currentIdentity.source, "PLAYER");
  assert.equal(merged.currentRelationship.source, "PLAYER");
  assert.equal(merged.persistentFacts.source, "PLAYER");
});
