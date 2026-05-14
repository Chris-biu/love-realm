import assert from "node:assert/strict";
import test from "node:test";
import { applyMetricDeltas, normalizeStatusMetrics, syncMetricRecord } from "./status-metrics";

test("falls back to the default metric template", () => {
  const metrics = normalizeStatusMetrics(null);

  assert.deepEqual(
    metrics.map((metric) => metric.key),
    ["trust", "affection", "tension", "curiosity"],
  );
});

test("normalization removes blanks, preserves labels, and deduplicates keys", () => {
  const metrics = normalizeStatusMetrics([
    { key: "trust", label: "Trust" },
    { key: "trust", label: "Trust Shift" },
    { key: "", label: "Possessiveness" },
    { key: "bad", label: "" },
  ]);

  assert.deepEqual(metrics, [
    { key: "trust", label: "Trust", max: 10 },
    { key: "trust_2", label: "Trust Shift", max: 10 },
    { key: "possessiveness", label: "Possessiveness", max: 10 },
  ]);
});

test("metric records follow the world template and each metric's own cap", () => {
  const template = [
    { key: "trust", label: "Trust", max: 20 },
    { key: "possessiveness", label: "Possessiveness", max: 6 },
  ];

  const record = syncMetricRecord(template, {
    trust: 14,
    affection: 9,
    possessiveness: 20,
  });

  assert.deepEqual(record, {
    trust: 14,
    possessiveness: 6,
  });
});

test("AI deltas update only declared metrics and stay within each cap", () => {
  const template = [
    { key: "trust", label: "Trust", max: 12 },
    { key: "jealousy", label: "Jealousy", max: 5 },
  ];

  const record = applyMetricDeltas(
    template,
    { trust: 9, jealousy: 1 },
    { trust: 5, jealousy: -3, removed: 9 },
  );

  assert.deepEqual(record, {
    trust: 12,
    jealousy: 0,
  });
});
