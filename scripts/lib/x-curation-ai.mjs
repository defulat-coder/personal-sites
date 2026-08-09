const DEFAULT_PROVIDER = "kimi-coding";
const DEFAULT_MODEL = "kimi-for-coding";

function firstDefined(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? "";
}

/**
 * Resolve the Pi Coding Agent model configuration. Kimi remains the default
 * provider while allowing a local Kimi model override for development.
 */
export function resolvePiModelConfig({ config = {}, env = process.env } = {}) {
  const ai = config.ai ?? {};
  return {
    provider: firstDefined(ai.provider, DEFAULT_PROVIDER),
    model: firstDefined(env.PI_MODEL, ai.model, DEFAULT_MODEL),
  };
}
