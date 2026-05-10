import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMetricDeltas,
  normalizeStatusMetrics,
  syncMetricRecord,
} from "./status-metrics";

test("没有模板数据时使用默认状态栏", () => {
  const metrics = normalizeStatusMetrics(null);

  assert.deepEqual(metrics.map((metric) => metric.key), [
    "trust",
    "affection",
    "tension",
    "curiosity",
  ]);
});

test("状态栏模板会清理空项并保证 key 唯一", () => {
  const metrics = normalizeStatusMetrics([
    { key: "trust", label: "信任" },
    { key: "trust", label: "信任变化" },
    { key: "", label: "占有欲" },
    { key: "bad", label: "" },
  ]);

  assert.deepEqual(metrics, [
    { key: "trust", label: "信任" },
    { key: "trust_2", label: "信任变化" },
    { key: "占有欲", label: "占有欲" },
  ]);
});

test("角色状态记录始终与世界模板一致", () => {
  const template = [
    { key: "trust", label: "信任" },
    { key: "possessiveness", label: "占有欲" },
  ];

  const record = syncMetricRecord(template, {
    trust: 4,
    affection: 9,
    possessiveness: 20,
  });

  assert.deepEqual(record, {
    trust: 4,
    possessiveness: 10,
  });
});

test("AI 状态变化只更新模板内字段并限制在 0 到 10", () => {
  const template = [
    { key: "trust", label: "信任" },
    { key: "jealousy", label: "嫉妒" },
  ];

  const record = applyMetricDeltas(
    template,
    { trust: 9, jealousy: 1 },
    { trust: 5, jealousy: -3, removed: 9 },
  );

  assert.deepEqual(record, {
    trust: 10,
    jealousy: 0,
  });
});
