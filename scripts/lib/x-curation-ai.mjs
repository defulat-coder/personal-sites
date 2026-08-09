const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1";
const DEFAULT_MODEL = "kimi-k2-0905-preview";

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "";
}

/**
 * Resolve the curation model configuration. Kimi is intentionally the only
 * default provider; the legacy X_CURATION_* names remain supported locally.
 */
export function resolveKimiConfig({ config = {}, env = process.env } = {}) {
  const ai = config.ai ?? {};
  return {
    provider: "kimi",
    apiKey: firstDefined(env.KIMI_API_KEY, env.MOONSHOT_API_KEY, env.X_CURATION_API_KEY),
    baseUrl: firstDefined(env.KIMI_BASE_URL, env.X_CURATION_BASE_URL, ai.baseUrl, DEFAULT_BASE_URL).replace(/\/$/u, ""),
    model: firstDefined(env.KIMI_MODEL, env.X_CURATION_MODEL, ai.model, DEFAULT_MODEL),
  };
}
