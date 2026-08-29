export function readPublicDataHealth(database) {
  const platforms = new Map(database.prepare(`SELECT json_extract(content_json, '$.source.platform') AS platform,
    count(*) AS count, max(coalesce(collected_at, published_at)) AS latest
    FROM curation_items GROUP BY platform`).all().map((row) => [row.platform, row]));
  const ask = database.prepare(`SELECT
    (SELECT count(*) FROM ask_documents) AS documents,
    (SELECT count(*) FROM ask_documents_fts) AS fts,
    (SELECT count(*) FROM ask_documents d LEFT JOIN ask_documents_fts f ON f.rowid = d.rowid WHERE f.rowid IS NULL) AS missing_fts,
    (SELECT count(*) FROM ask_documents_fts f LEFT JOIN ask_documents d ON d.rowid = f.rowid WHERE d.rowid IS NULL) AS orphan_fts`).get();
  const latest = (table) => database.prepare(`SELECT count(*) AS count, max(published_at) AS latest FROM ${table}`).get();
  const openSource = latest("open_source_items");
  const works = latest("project_snapshots");
  return {
    askDocuments: Number(ask.documents),
    askFts: Number(ask.fts),
    askMissingFts: Number(ask.missing_fts),
    askOrphanFts: Number(ask.orphan_fts),
    curation: {
      douyin: { count: Number(platforms.get("douyin")?.count ?? 0), latestAt: platforms.get("douyin")?.latest ?? null },
      x: { count: Number(platforms.get("x")?.count ?? 0), latestAt: platforms.get("x")?.latest ?? null },
    },
    openSource: { count: Number(openSource.count), latestAt: openSource.latest ?? null },
    quickCheck: String(database.pragma("quick_check", { simple: true })),
    works: { count: Number(works.count), latestAt: works.latest ?? null },
  };
}
