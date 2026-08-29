export function toPublicAiNewsHealth(health) {
  return {
    ageMinutes: health.ageMinutes,
    healthy: health.healthy,
    lastStartedAt: health.lastStartedAt ?? null,
    lastSucceededAt: health.lastSucceededAt ?? null,
    running: health.running,
  };
}
