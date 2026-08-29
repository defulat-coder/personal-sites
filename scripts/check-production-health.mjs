#!/usr/bin/env node

const endpoint = process.env.DATA_HEALTH_URL ?? "https://default-coder.lovemyrmb.cn/api/health/data";
const attempts = Number.parseInt(process.env.HEALTH_ATTEMPTS ?? "3", 10);
const retryMilliseconds = Number.parseInt(process.env.HEALTH_RETRY_MS ?? "60000", 10);

if (!Number.isInteger(attempts) || attempts < 1) throw new Error("HEALTH_ATTEMPTS 必须是正整数。");
if (!Number.isInteger(retryMilliseconds) || retryMilliseconds < 0) throw new Error("HEALTH_RETRY_MS 必须是非负整数。");

let lastFailure = "unknown";
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const payload = await response.json();
    if (response.ok && payload.healthy === true) {
      console.log(`生产数据健康：正常（${payload.deployment?.commit ?? "unknown commit"}）`);
      process.exit(0);
    }
    lastFailure = `HTTP ${response.status}: ${JSON.stringify(payload)}`;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }
  console.error(`生产数据健康检查 ${attempt}/${attempts} 失败：${lastFailure}`);
  if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, retryMilliseconds));
}

throw new Error(`生产数据连续 ${attempts} 次异常：${lastFailure}`);
