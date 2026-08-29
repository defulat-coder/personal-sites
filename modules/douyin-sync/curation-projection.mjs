function toIsoDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toOrder(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function toPublicDouyinItem(item) {
  if (!item.review?.approved) throw new Error(`${item.id} 未完成自动批准，不能进入公开每日关注。`);
  const id = `douyin-${item.id.replace(/^douyin:/u, "")}`;
  return {
    analysis: item.ai.analysis,
    author: item.author,
    collectedAt: toIsoDate(item.collectedAt),
    collectedOrder: toOrder(item.collectedOrder),
    id,
    links: [],
    media: [],
    publishedAt: toIsoDate(item.publishedAt),
    quoteContext: null,
    source: {
      label: "抖音视频",
      platform: "douyin",
      url: item.sourceUrl,
    },
    summary: item.ai.summary,
    tags: item.ai.tags,
    text: item.ai.excerpt,
    title: item.ai.title,
  };
}
