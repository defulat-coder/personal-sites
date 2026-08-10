type PiSession = {
  state?: {
    messages?: Array<{
      content?: unknown;
      errorMessage?: unknown;
      role?: unknown;
      stopReason?: unknown;
    }>;
  };
};

export function resolvePiModelConfig(options?: {
  config?: { ai?: { model?: string; provider?: string } };
  env?: NodeJS.ProcessEnv;
}): { model: string; provider: string };

export function getFinalAssistantText(session: PiSession): string;
export function getFinalAssistantFailure(session: PiSession): string;
