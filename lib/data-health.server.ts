import "server-only";

import { readAiNewsCronHealth } from "@/lib/ai-news-sync.server";
import { getPublicDatabase } from "@/lib/public-database";
import { readPublicDataHealth } from "@/modules/data-health/sqlite.mjs";
import { buildDataHealth } from "@/modules/data-health/status.mjs";

export async function readDataHealth() {
  const database = getPublicDatabase();
  return buildDataHealth({
    aiNews: await readAiNewsCronHealth(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    publicData: readPublicDataHealth(database),
  });
}
