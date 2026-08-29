import "server-only";

import { searchAiNewsDocuments } from "@/lib/ai-news";
import { getAskSearchFallbackTerms } from "@/lib/ask-search-terms";
import { searchLocalAskDocuments } from "@/lib/curation";
import type { AskScope, AskSource } from "@/lib/ask-types";

type SearchDocument = {
  content: string;
  id: string;
  publishedAt: string | null;
  score: number;
  scope: Exclude<AskScope, "all">;
  section: string | null;
  sourceId: string;
  sourceUrl: string;
  title: string;
};

function rankDocuments(documents: SearchDocument[]) {
  return [...documents]
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, 6);
}

async function searchDocuments(query: string, scope: AskScope): Promise<SearchDocument[]> {
  const localScopes = scope === "all"
    ? ["profile", "works", "daily", "open-source"] as const
    : scope === "ai-news" ? [] : [scope];
  const localDocuments = localScopes.flatMap((localScope) => searchLocalAskDocuments(query, localScope));
  const aiDocuments = scope === "all" || scope === "ai-news"
    ? (await searchAiNewsDocuments(query)).map((document) => ({
        ...document,
        scope: "ai-news" as const,
        section: null,
      }))
    : [];
  return rankDocuments([...localDocuments, ...aiDocuments]);
}

function toAskSource(document: SearchDocument): AskSource {
  return {
    content: document.content,
    id: document.id,
    publishedAt: document.publishedAt,
    scope: document.scope,
    section: document.section,
    sourceId: document.sourceId,
    sourceUrl: document.sourceUrl,
    title: document.title,
  };
}

function mergeFallbackDocuments(results: SearchDocument[][]) {
  const documents = new Map<string, { document: SearchDocument; matches: number; score: number }>();
  for (const batch of results) {
    for (const document of batch) {
      const existing = documents.get(document.id);
      if (existing) {
        existing.matches += 1;
        existing.score += document.score;
      } else {
        documents.set(document.id, { document, matches: 1, score: document.score });
      }
    }
  }

  return [...documents.values()]
    .sort((left, right) => right.matches - left.matches || right.score - left.score
      || (right.document.publishedAt ?? "").localeCompare(left.document.publishedAt ?? ""))
    .slice(0, 6)
    .map(({ document }) => toAskSource(document));
}

export async function searchAskDocuments(query: string, scope: AskScope): Promise<AskSource[]> {
  const exactDocuments = await searchDocuments(query, scope);
  if (exactDocuments.length > 0) return exactDocuments.map(toAskSource);

  const fallbackTerms = getAskSearchFallbackTerms(query);
  if (fallbackTerms.length === 0) return [];
  return mergeFallbackDocuments(await Promise.all(fallbackTerms.map((term) => searchDocuments(term, scope))));
}
