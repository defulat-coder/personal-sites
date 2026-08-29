const MINUTE_MS = 60_000;

function ageMinutes(value, now) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.round((now.getTime() - timestamp) / MINUTE_MS)) : null;
}

function sourceStatus(source, now, staleAfterMinutes, warnings, label) {
  const age = ageMinutes(source.latestAt, now);
  const healthy = source.count > 0 && age !== null && age <= staleAfterMinutes;
  if (!healthy) warnings.push(`${label} 已超过 ${Math.round(staleAfterMinutes / 60)} 小时未更新。`);
  return { ...source, ageMinutes: age, healthy };
}

export function buildDataHealth({ aiNews, commit = null, insights = null, now = new Date(), publicData }) {
  const warnings = [];
  const askIndex = {
    documents: publicData.askDocuments,
    fts: publicData.askFts,
    healthy: publicData.askDocuments > 0 && publicData.askDocuments === publicData.askFts,
  };
  const curation = {
    douyin: sourceStatus(publicData.curation.douyin, now, 14 * 24 * 60, warnings, "抖音收藏"),
    x: sourceStatus(publicData.curation.x, now, 72 * 60, warnings, "X 策展"),
  };
  const openSource = sourceStatus(publicData.openSource, now, 14 * 24 * 60, warnings, "开源关注");
  const works = {
    ...publicData.works,
    ageMinutes: ageMinutes(publicData.works.latestAt, now),
    healthy: publicData.works.count > 0,
  };
  const analysisHealthy = !insights || Number(insights.analysisErrors ?? 0) === 0;
  if (Number(insights?.designReview ?? 0) > 0) warnings.push(`仍有 ${insights.designReview} 条设计分类待复核。`);
  const healthy = Boolean(aiNews.healthy && askIndex.healthy && curation.x.healthy && curation.douyin.healthy
    && openSource.healthy && works.healthy && analysisHealthy);
  return {
    aiNews,
    askIndex,
    curation,
    deployment: { commit },
    generatedAt: now.toISOString(),
    healthy,
    insights,
    openSource,
    warnings,
    works,
  };
}
