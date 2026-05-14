type RetrievalRecord = {
  text: string;
  score: number;
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreText(queryTokens: string[], text: string) {
  if (!queryTokens.length) return 0;
  const haystack = text.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += token.length > 2 ? 2 : 1;
  }
  return score;
}

function dedupe(records: RetrievalRecord[]) {
  const seen = new Set<string>();
  const result: RetrievalRecord[] = [];

  for (const record of records) {
    const key = record.text.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }

  return result;
}

export function retrieveRelevantText(
  items: string[],
  query: string,
  limit: number,
) {
  const queryTokens = tokenize(query);
  const scored = dedupe(
    items.map((text) => ({
      text,
      score: scoreText(queryTokens, text),
    })),
  );

  const ranked = scored
    .sort((a, b) => (b.score - a.score) || (b.text.length - a.text.length))
    .slice(0, Math.max(0, limit));

  if (ranked.some((item) => item.score > 0)) {
    return ranked.filter((item) => item.score > 0).map((item) => item.text);
  }

  return scored.slice(0, Math.max(0, limit)).map((item) => item.text);
}
