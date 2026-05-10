type SuggestedPromptParams = {
  scene: string;
  atmosphere: string;
  characterNames: string[];
  fromModel?: string[];
};

function uniqueNonEmpty(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function buildFallbackSuggestedPrompts(params: {
  scene: string;
  atmosphere: string;
  characterNames: string[];
}) {
  const [first = "对方", second = "另一位角色", third = "现场的人"] = params.characterNames;

  return uniqueNonEmpty([
    `继续追问${first}在${params.scene}里隐瞒的细节`,
    `观察${second}在“${params.atmosphere}”气氛下的真实反应`,
    `主动做出行动，试探${third}接下来会不会表态`,
  ]).slice(0, 3);
}

export function pickSuggestedPrompts(params: SuggestedPromptParams) {
  const picked = uniqueNonEmpty(params.fromModel ?? []);
  const fallback = buildFallbackSuggestedPrompts(params);

  return uniqueNonEmpty([...picked, ...fallback]).slice(0, 3);
}
