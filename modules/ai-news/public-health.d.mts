export type PublicAiNewsHealth = {
  ageMinutes: number | null;
  healthy: boolean;
  lastStartedAt: string | null;
  lastSucceededAt: string | null;
  running: boolean;
};

export function toPublicAiNewsHealth(health: PublicAiNewsHealth & { lastError?: unknown }): PublicAiNewsHealth;
