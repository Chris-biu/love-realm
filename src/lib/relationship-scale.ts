import type { StatusMetricDefinition } from "@/lib/status-metrics";

export const RELATIONSHIP_MIN = 0;
export const RELATIONSHIP_MAX = 10;

function normalizeMetricMax(max?: number) {
  if (!Number.isFinite(max ?? NaN)) {
    return RELATIONSHIP_MAX;
  }

  return Math.max(3, Math.min(100, Math.round(max!)));
}

export function getMetricMax(metric?: Pick<StatusMetricDefinition, "max"> | null) {
  return normalizeMetricMax(metric?.max);
}

export function clampRelationshipMetric(value: number, max = RELATIONSHIP_MAX) {
  const normalizedMax = normalizeMetricMax(max);
  if (!Number.isFinite(value)) {
    return RELATIONSHIP_MIN;
  }

  return Math.min(normalizedMax, Math.max(RELATIONSHIP_MIN, Math.round(value)));
}

export function applyRelationshipDelta(currentValue: number | undefined, delta: number, max = RELATIONSHIP_MAX) {
  return clampRelationshipMetric((currentValue ?? RELATIONSHIP_MIN) + delta, max);
}

export function getRelationshipStage(value: number, metric?: string, max = RELATIONSHIP_MAX) {
  const normalizedMax = normalizeMetricMax(max);
  const clamped = clampRelationshipMetric(value, normalizedMax);
  const ratio = normalizedMax === 0 ? 0 : clamped / normalizedMax;

  if (metric === "tension") {
    if (ratio <= 0.2) return "平稳";
    if (ratio <= 0.5) return "微妙";
    if (ratio <= 0.8) return "紧绷";
    return "危险";
  }

  if (metric === "curiosity") {
    if (ratio <= 0.2) return "冷淡";
    if (ratio <= 0.5) return "留意";
    if (ratio <= 0.8) return "在意";
    return "执着";
  }

  if (ratio <= 0.2) return "疏离";
  if (ratio <= 0.5) return "试探";
  if (ratio <= 0.8) return "亲近";
  return "深度信赖";
}
