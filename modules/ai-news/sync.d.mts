import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiNewsStateStore, AiNewsSyncStats } from "./state.mjs";

export function syncAiNews(options?: {
  backfill?: boolean;
  clientFactory?: (
    url: string,
    key: string,
    options: unknown,
  ) => SupabaseClient;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: Date;
  stateStore?: AiNewsStateStore;
}): Promise<AiNewsSyncStats>;
