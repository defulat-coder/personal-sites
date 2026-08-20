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

  it("evicts least recently used IPs beyond the tracking cap", () => {
    const limiter = new AskRateLimiter(1, 10 * 60 * 1000, 2);
    const now = 1_000_000;

    expect(limiter.check("203.0.113.10", now).allowed).toBe(true);
    expect(limiter.check("203.0.113.10", now).allowed).toBe(false);
    limiter.check("203.0.113.11", now);
    // 容量为 2：第三个 IP 到来时驱逐最久未访问的 .10
    limiter.check("203.0.113.12", now);

    // .11 仍被跟踪，窗口内的第二次请求被拒
    expect(limiter.check("203.0.113.11", now).allowed).toBe(false);
    // .10 已被驱逐，计数从头开始
    expect(limiter.check("203.0.113.10", now).allowed).toBe(true);
  });
});
