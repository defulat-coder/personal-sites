import type { SupabaseClient } from "@supabase/supabase-js";

export type AiNewsSyncStats = {
  backfill: boolean;
  modes: Record<string, { changed: boolean; count: number | null }>;
  publicCount: number;
  skipped: boolean;
};

export type AiNewsStateStore = {
  acquire(options: {
    backfill?: boolean;
    now: Date;
  }): Promise<{ acquired: boolean; etags: Record<string, string | null> }>;
  fail(error: unknown): Promise<void>;
  health(options?: { now?: Date; staleAfterMinutes?: number }): Promise<{
    ageMinutes: number | null;
    healthy: boolean;
    lastError: string | null;
    lastStartedAt: string | null;
    lastSucceededAt: string | null;
    running: boolean;
  }>;
  isAuthorized(secret: string | null): Promise<boolean>;
  succeed(options: {
    completedAt?: Date;
    etags: Record<string, string | null>;
    stats: AiNewsSyncStats;
  }): Promise<void>;
};

export function createSupabaseAiNewsStateStore(
  client: SupabaseClient,
): AiNewsStateStore;
