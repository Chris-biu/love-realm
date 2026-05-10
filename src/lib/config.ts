export const DEFAULT_WORLD_SLUG = "moonlit-residence";

export const DEFAULT_DEEPSEEK_MODEL =
  process.env.DEFAULT_DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";

export const AVAILABLE_DEEPSEEK_MODELS = Array.from(
  new Set([DEFAULT_DEEPSEEK_MODEL, "deepseek-v4-flash", "deepseek-v4-pro"]),
);

export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
export function normalizeDeepSeekModel(model?: string | null) {
  if (model === "deepseek-chat" || model === "deepseek-reasoner") {
    return "deepseek-v4-flash";
  }

  return model?.trim() || DEFAULT_DEEPSEEK_MODEL;
}