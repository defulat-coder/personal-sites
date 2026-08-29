import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkAskRateLimit } from "@/lib/ask-limiter.server";

describe("shared Ask rate limiter", () => {
  beforeEach(() => {
    vi.stubEnv("ASK_SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  });

  it("hashes the IP before calling the Supabase atomic limiter", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, retry_after_seconds: 0 }],
      error: null,
    });
    const result = await checkAskRateLimit("203.0.113.1", 1_000_000, { rpc } as never);

    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(rpc).toHaveBeenCalledWith("check_ask_rate_limit", {
      p_ip_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_now: new Date(1_000_000).toISOString(),
    });
    expect(rpc.mock.calls[0]?.[1]?.p_ip_hash).not.toContain("203.0.113.1");
  });

  it("returns the shared retry window", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: false, retry_after_seconds: 321 }],
      error: null,
    });

    await expect(checkAskRateLimit("203.0.113.1", Date.now(), { rpc } as never)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 321,
    });
  });
});
