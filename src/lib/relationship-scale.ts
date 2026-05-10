export const RELATIONSHIP_MIN = 0;
export const RELATIONSHIP_MAX = 10;

export function clampRelationshipMetric(value: number) {
  if (!Number.isFinite(value)) {
    return RELATIONSHIP_MIN;
  }

  return Math.min(RELATIONSHIP_MAX, Math.max(RELATIONSHIP_MIN, Math.round(value)));
}

export function applyRelationshipDelta(currentValue: number | undefined, delta: number) {
  return clampRelationshipMetric((currentValue ?? RELATIONSHIP_MIN) + delta);
}

export function getRelationshipStage(value: number, metric?: string) {
  const clamped = clampRelationshipMetric(value);

  if (metric === "tension") {
    if (clamped <= 2) {
      return "平稳";
    }

    if (clamped <= 5) {
      return "微妙";
    }

    if (clamped <= 8) {
      return "紧绷";
    }

    return "危险";
  }

  if (metric === "curiosity") {
    if (clamped <= 2) {
      return "冷淡";
    }

    if (clamped <= 5) {
      return "留意";
    }

    if (clamped <= 8) {
      return "在意";
    }

    return "执着";
  }

  if (clamped <= 2) {
    return "疏离";
  }

  if (clamped <= 5) {
    return "试探";
  }

  if (clamped <= 8) {
    return "亲近";
  }

  return "深度信赖";
}
