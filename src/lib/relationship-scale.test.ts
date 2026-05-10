import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRelationshipDelta,
  clampRelationshipMetric,
  getRelationshipStage,
} from "./relationship-scale";

test("关系数值被限制在 0 到 10", () => {
  assert.equal(clampRelationshipMetric(-3), 0);
  assert.equal(clampRelationshipMetric(4), 4);
  assert.equal(clampRelationshipMetric(15), 10);
});

test("应用关系变化时不会低于 0 或高于 10", () => {
  assert.equal(applyRelationshipDelta(9, 4), 10);
  assert.equal(applyRelationshipDelta(1, -5), 0);
  assert.equal(applyRelationshipDelta(undefined, 3), 3);
});

test("关系阶段按照 0 到 10 量表返回中文标签", () => {
  assert.equal(getRelationshipStage(1), "疏离");
  assert.equal(getRelationshipStage(4), "试探");
  assert.equal(getRelationshipStage(7), "亲近");
  assert.equal(getRelationshipStage(10), "深度信赖");
});

test("紧张和好奇使用各自更贴切的阶段文案", () => {
  assert.equal(getRelationshipStage(1, "tension"), "平稳");
  assert.equal(getRelationshipStage(7, "tension"), "紧绷");
  assert.equal(getRelationshipStage(4, "curiosity"), "留意");
  assert.equal(getRelationshipStage(10, "curiosity"), "执着");
});
