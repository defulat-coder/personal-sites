import "server-only";

import { AskRateLimiter } from "@/lib/ask-rate-limiter";

const localAskRateLimiter = new AskRateLimiter();

export function checkAskRateLimit(ip: string, now = Date.now()) {
  return localAskRateLimiter.check(ip, now);
}
