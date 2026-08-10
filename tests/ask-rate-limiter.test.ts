import { describe, expect, it } from "vitest";

import { AskRateLimiter } from "@/lib/ask-rate-limiter";

describe("AskRateLimiter", () => {
  it("allows at most 50 requests from one IP every ten minutes", () => {
    const limiter = new AskRateLimiter();
    const now = 1_000_000;

    for (let index = 0; index < 50; index += 1) {
      expect(limiter.check("203.0.113.1", now)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    }
    expect(limiter.check("203.0.113.1", now)).toEqual({ allowed: false, retryAfterSeconds: 600 });
    expect(limiter.check("203.0.113.1", now + 10 * 60 * 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });
});
