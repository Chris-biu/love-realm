import { clampRelationshipMetric } from "@/lib/relationship-scale";

export type StatusMetricDefinition = {
  key: string;
  label: string;
};

export const DEFAULT_STATUS_METRICS: StatusMetricDefinition[] = [
  { key: "trust", label: "信任" },
  { key: "affection", label: "好感" },
  { key: "tension", label: "紧张" },
  { key: "curiosity", label: "好奇" },
];

function slugifyMetricKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `metric_${Date.now()}`;
}

export function normalizeStatusMetrics(value: unknown): StatusMetricDefinition[] {
  if (!Array.isArray(value)) {
    return DEFAULT_STATUS_METRICS;
  }

  const usedKeys = new Set<string>();
  const result: StatusMetricDefinition[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Partial<StatusMetricDefinition>;
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const rawKey = typeof candidate.key === "string" && candidate.key.trim() ? candidate.key : label;
    const baseKey = slugifyMetricKey(rawKey);

    if (!label) {
      continue;
    }

    let key = baseKey;
    let index = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}_${index}`;
      index += 1;
    }

    usedKeys.add(key);
    result.push({ key, label });
  }

  return result;
}

export function syncMetricRecord(
  template: StatusMetricDefinition[],
  current: Record<string, number>,
) {
  const next: Record<string, number> = {};

  for (const metric of template) {
    next[metric.key] = clampRelationshipMetric(current[metric.key] ?? 0);
  }

  return next;
}

export function applyMetricDeltas(
  template: StatusMetricDefinition[],
  current: Record<string, number>,
  changes: Record<string, number>,
) {
  const next = syncMetricRecord(template, current);
  const allowedKeys = new Set(template.map((metric) => metric.key));

  for (const [key, delta] of Object.entries(changes)) {
    if (!allowedKeys.has(key) || typeof delta !== "number") {
      continue;
    }

    next[key] = clampRelationshipMetric((next[key] ?? 0) + delta);
  }

  return next;
}

export function buildInitialMetricRecord(template: StatusMetricDefinition[]) {
  return syncMetricRecord(template, {});
}
