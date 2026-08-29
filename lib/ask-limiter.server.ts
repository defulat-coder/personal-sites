import "server-only";

import { createHmac } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  retry_after_seconds: z.number().int().nonnegative(),
});

function requiredEnvironment(key: "ASK_SESSION_SECRET" | "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；无法执行公开问答共享限流。`);
  return value;
}

function getRateLimitClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function checkAskRateLimit(ip: string, now = Date.now(), client: SupabaseClient = getRateLimitClient()) {
  const ipHash = createHmac("sha256", requiredEnvironment("ASK_SESSION_SECRET")).update(ip).digest("hex");
  const { data, error } = await client.rpc("check_ask_rate_limit", {
    p_ip_hash: ipHash,
    p_now: new Date(now).toISOString(),
  });
  if (error) throw new Error(`执行公开问答共享限流失败：${error.message}`);
  const result = rateLimitResultSchema.parse(data?.[0]);
  return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
}
