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
  return {
    id: item.id,
    title: item.ai.title,
    summary: item.ai.summary,
    tags: item.ai.tags,
    text: item.text,
    quoteContext:
      item.isQuote && item.quoteContext
        ? {
            author: item.quoteContext.author ?? "",
            authorName: item.quoteContext.authorName ?? "",
            text: item.quoteContext.text ?? "",
          }
        : null,
    analysis: item.ai.analysis,
    author: {
      handle: item.author.handle,
      name: item.author.name,
    },
    source: {
      label: "X 原文",
      platform: "x",
      url: item.tweetUrl,
    },
    links: [
      ...new Map(
        item.links
          .filter((link) => link.expanded && link.type !== "tweet")
          .map((link) => [
            link.expanded,
            { type: link.type, url: link.expanded, shortUrl: link.original ?? null },
          ]),
      ).values(),
    ],
    media: (item.media ?? []).filter((media) => media.url),
    collectedAt: toIsoDate(item.firstSeenAt),
    collectedOrder: toOrder(item.firstSeenOrder),
    publishedAt: toIsoDate(item.createdAt),
  };
}
