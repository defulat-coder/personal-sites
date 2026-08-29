import { designClassificationStatus } from "./design-classification.mjs";
import { prepareCurationItem } from "./analysis.mjs";

export function isReadyForPublication(item) {
  return Boolean(
    item.ai?.title
      && item.ai.summary
      && item.ai.analysis
      && Array.isArray(item.ai.tags)
      && item.ai.tags.length > 0,
  );
}

function toIsoDate(createdAt) {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toOrder(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function toPublicCurationItem(item) {
  const prepared = prepareCurationItem(item);
  return {
    id: prepared.id,
    title: prepared.ai.title,
    summary: prepared.ai.summary,
    tags: prepared.ai.tags,
    text: prepared.text,
    facts: prepared.facts,
    searchSignals: prepared.ai.searchSignals ?? null,
    visualFacts: prepared.ai.visualFacts ?? null,
    quoteContext:
      prepared.isQuote && prepared.quoteContext
        ? {
            author: prepared.quoteContext.author ?? "",
            authorName: prepared.quoteContext.authorName ?? "",
            text: prepared.quoteContext.text ?? "",
          }
        : null,
    analysis: prepared.ai.analysis,
    design: prepared.ai.design
      ? {
          ...prepared.ai.design,
          status: designClassificationStatus(prepared.ai.design.relevant, prepared.ai.design.confidence),
        }
      : null,
    author: {
      handle: prepared.author.handle,
      name: prepared.author.name,
    },
    source: {
      label: "X 原文",
      platform: "x",
      url: prepared.tweetUrl,
    },
    links: [
      ...new Map(
        prepared.links
          .filter((link) => link.expanded && link.type !== "tweet")
          .map((link) => [
            link.expanded,
            { type: link.type, url: link.expanded, shortUrl: link.original ?? null },
          ]),
      ).values(),
    ],
    media: (prepared.media ?? []).filter((media) => media.url),
    collectedAt: toIsoDate(prepared.firstSeenAt),
    collectedOrder: toOrder(prepared.firstSeenOrder),
    publishedAt: toIsoDate(prepared.createdAt),
  };
}
