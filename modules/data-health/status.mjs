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
  const database = { healthy: publicData.quickCheck === "ok", quickCheck: publicData.quickCheck };
  if (!database.healthy) warnings.push(`SQLite 完整性检查失败：${database.quickCheck}`);
  const askIndex = {
    documents: publicData.askDocuments,
    fts: publicData.askFts,
    missingFts: publicData.askMissingFts,
    orphanFts: publicData.askOrphanFts,
    healthy: publicData.askDocuments > 0 && publicData.askDocuments === publicData.askFts
      && publicData.askMissingFts === 0 && publicData.askOrphanFts === 0,
  };
  if (!askIndex.healthy) warnings.push(`Ask FTS 不一致：缺失 ${askIndex.missingFts}，孤儿 ${askIndex.orphanFts}。`);
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
  const healthy = Boolean(aiNews.healthy && database.healthy && askIndex.healthy && curation.x.healthy && curation.douyin.healthy
    && openSource.healthy && works.healthy && analysisHealthy);
  return {
    aiNews,
    askIndex,
    curation,
    database,
    deployment: { commit },
    generatedAt: now.toISOString(),
    healthy,
    insights,
    openSource,
    warnings,
    works,
  };
}
