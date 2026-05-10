import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFallbackSuggestedPrompts,
  pickSuggestedPrompts,
} from "./suggested-prompts";

test("优先采用模型返回的三条上下文提示", () => {
  const result = pickSuggestedPrompts({
    fromModel: ["继续追问林月", "转移话题观察顾景", "先稳住苏棠情绪"],
    scene: "雨夜书房",
    atmosphere: "气氛紧张",
    characterNames: ["林月", "顾景", "苏棠"],
  });

  assert.deepEqual(result, ["继续追问林月", "转移话题观察顾景", "先稳住苏棠情绪"]);
});

test("模型建议不足三条时用上下文兜底补足", () => {
  const result = pickSuggestedPrompts({
    fromModel: ["主动解释刚才的迟疑"],
    scene: "公馆露台",
    atmosphere: "暧昧又试探",
    characterNames: ["林月", "顾景", "苏棠"],
  });

  assert.equal(result.length, 3);
  assert.equal(result[0], "主动解释刚才的迟疑");
});

test("没有模型建议时生成与场景和角色相关的三条提示", () => {
  const result = buildFallbackSuggestedPrompts({
    scene: "月下回廊",
    atmosphere: "安静里带着戒备",
    characterNames: ["林月", "顾景", "苏棠"],
  });

  assert.equal(result.length, 3);
  assert.ok(result.some((item) => item.includes("林月")));
  assert.ok(result.every((item) => item.length >= 6));
});
