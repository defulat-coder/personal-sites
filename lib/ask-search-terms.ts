const MAX_FALLBACK_TERMS = 4;

const IGNORED_TERMS = new Set([
  "一下",
  "什么",
  "内容",
  "关于",
  "如何",
  "实践",
  "怎么",
  "怎样",
  "最近",
  "有无",
  "有关",
  "有哪些",
  "给我",
  "请问",
  "那个",
  "哪些",
  "相关",
  "知道",
  "需要",
  "麻烦",
  "帮我",
]);

function isSearchTerm(value: string) {
  return /^[A-Za-z][A-Za-z0-9._-]+$/.test(value) || /^[\u3400-\u9FFF]{2,}$/.test(value);
}

/**
 * Keeps full-text search literal while extracting meaningful fallback terms
 * from a natural-language question after its exact form returns no documents.
 */
export function getAskSearchFallbackTerms(query: string) {
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const terms = new Map<string, string>();

  for (const segment of segmenter.segment(query)) {
    const value = segment.segment.trim();
    if (!isSearchTerm(value) || IGNORED_TERMS.has(value)) continue;
    terms.set(value.toLocaleLowerCase("en-US"), value);
    if (terms.size >= MAX_FALLBACK_TERMS) break;
  }

  return [...terms.values()];
}
