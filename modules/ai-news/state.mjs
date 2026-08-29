import { createHash, timingSafeEqual } from "node:crypto";

const STATE_ID = "default";
const LEASE_MS = 4 * 60 * 1000;

function hashSecret(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

function sameHash(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createSupabaseAiNewsStateStore(client) {
  return {
    async acquire({ now }) {
      const startedAt = now.toISOString();
      const leaseUntil = new Date(now.getTime() + LEASE_MS).toISOString();
      const { data, error } = await client
        .from("ai_news_sync_state")
        .update({
          last_error: null,
          last_started_at: startedAt,
          lease_until: leaseUntil,
        })
        .eq("id", STATE_ID)
        .or(`lease_until.is.null,lease_until.lt.${startedAt}`)
        .select("etags")
        .maybeSingle();
      if (error) throw new Error(`获取每日动态同步租约失败：${error.message}`);
      return data
        ? { acquired: true, etags: data.etags ?? {} }
        : { acquired: false, etags: {} };
    },

    async succeed({ completedAt = new Date(), etags, stats }) {
      const { error } = await client
        .from("ai_news_sync_state")
        .update({
          etags,
          last_error: null,
          last_stats: stats,
          last_succeeded_at: completedAt.toISOString(),
          lease_until: null,
        })
        .eq("id", STATE_ID);
      if (error)
        throw new Error(`记录每日动态同步成功状态失败：${error.message}`);
    },

    async fail(error, { completedAt = new Date() } = {}) {
      const { error: stateError } = await client
        .from("ai_news_sync_state")
        .update({
          last_error: String(error?.message ?? error).slice(0, 1000),
          last_stats: {},
          lease_until: null,
        })
        .eq("id", STATE_ID);
      if (stateError)
        throw new Error(`记录每日动态同步失败状态失败：${stateError.message}`);
    },

    async isAuthorized(secret) {
      if (!secret) return false;
      const { data, error } = await client
        .from("ai_news_sync_state")
        .select("cron_secret_hash")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (error)
        throw new Error(`读取每日动态 Cron 密钥摘要失败：${error.message}`);
      return Boolean(
        data?.cron_secret_hash &&
          sameHash(hashSecret(secret), data.cron_secret_hash),
      );
    },

    async health({ now = new Date(), staleAfterMinutes = 20 } = {}) {
      const { data, error } = await client
        .from("ai_news_sync_state")
        .select("last_succeeded_at,last_started_at,lease_until")
        .eq("id", STATE_ID)
        .maybeSingle();
      if (error)
        throw new Error(`读取每日动态同步健康状态失败：${error.message}`);
      const ageMinutes = data?.last_succeeded_at
        ? Math.max(
            0,
            Math.round(
              (now.getTime() - Date.parse(data.last_succeeded_at)) / 60_000,
            ),
          )
        : null;
      return {
        ageMinutes,
        healthy: ageMinutes !== null && ageMinutes <= staleAfterMinutes,
        lastStartedAt: data?.last_started_at ?? null,
        lastSucceededAt: data?.last_succeeded_at ?? null,
        running: Boolean(
          data?.lease_until && Date.parse(data.lease_until) > now.getTime(),
        ),
      };
    },
  };
}
