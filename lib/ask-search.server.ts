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

type RankedBatch = { documents: SearchDocument[]; weight?: number };

export function fuseAskSearchDocuments(batches: RankedBatch[], limit = 6): SearchDocument[] {
  const fused = new Map<string, { document: SearchDocument; matches: number; rawScore: number; score: number }>();
  for (const { documents, weight = 1 } of batches) {
    documents.forEach((document, index) => {
      const existing = fused.get(document.id) ?? { document, matches: 0, rawScore: 0, score: 0 };
      existing.matches += 1;
      existing.rawScore += document.score;
      existing.score += weight / (index + 1);
      fused.set(document.id, existing);
    });
  }
  return [...fused.values()]
    .sort((left, right) => right.score - left.score || right.matches - left.matches || right.rawScore - left.rawScore
      || (right.document.publishedAt ?? "").localeCompare(left.document.publishedAt ?? ""))
    .slice(0, limit)
    .map(({ document, score }) => ({ ...document, score }));
}

async function searchDocuments(query: string, scope: AskScope): Promise<SearchDocument[]> {
  const localScopes = scope === "all"
    ? ["profile", "works", "daily", "open-source"] as const
    : scope === "ai-news" ? [] : [scope];
  const batches: RankedBatch[] = localScopes.map((localScope) => ({
    documents: searchLocalAskDocuments(query, localScope),
  }));
  const aiDocuments = scope === "all" || scope === "ai-news"
    ? (await searchAiNewsDocuments(query)).map((document) => ({
        ...document,
        scope: "ai-news" as const,
        section: null,
      }))
    : [];
  if (aiDocuments.length > 0) batches.push({ documents: aiDocuments });
  return fuseAskSearchDocuments(batches);
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

export async function searchAskDocuments(query: string, scope: AskScope): Promise<AskSource[]> {
  const exactDocuments = await searchDocuments(query, scope);
  const fallbackTerms = getAskSearchFallbackTerms(query);
  if (fallbackTerms.length === 0) return exactDocuments.map(toAskSource);
  const fallbackDocuments = await Promise.all(fallbackTerms.map((term) => searchDocuments(term, scope)));
  return fuseAskSearchDocuments([
    { documents: exactDocuments, weight: 2 },
    ...fallbackDocuments.map((documents) => ({ documents })),
  ]).map(toAskSource);
}
