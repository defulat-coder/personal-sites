import "server-only";

import { createClient } from "@supabase/supabase-js";

import { syncAiNews } from "@/modules/ai-news/sync.mjs";
import { toPublicAiNewsHealth } from "@/modules/ai-news/public-health.mjs";
import { createSupabaseAiNewsStateStore } from "@/modules/ai-news/state.mjs";

function requiredEnvironment(
  key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；每日动态同步只能在服务端运行。`);
  return value;
}

function createAdminClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function authorizeAiNewsCron(secret: string | null) {
  return createSupabaseAiNewsStateStore(createAdminClient()).isAuthorized(
    secret,
  );
}

export async function runAiNewsCron(backfill = false) {
  const client = createAdminClient();
  return syncAiNews({
    backfill,
    clientFactory: () => client,
    stateStore: createSupabaseAiNewsStateStore(client),
  });
}

export async function readAiNewsCronHealth() {
  return toPublicAiNewsHealth(await createSupabaseAiNewsStateStore(createAdminClient()).health());
}
