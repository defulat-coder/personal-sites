export type AskRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class AskRateLimiter {
  private readonly visitsByIp = new Map<string, number[]>();

  constructor(
    private readonly maximumRequests = 50,
    private readonly windowMilliseconds = 10 * 60 * 1_000,
  ) {}

  check(ip: string, now = Date.now()): AskRateLimitResult {
    const threshold = now - this.windowMilliseconds;
    const visits = (this.visitsByIp.get(ip) ?? []).filter((timestamp) => timestamp > threshold);
    if (visits.length >= this.maximumRequests) {
      this.visitsByIp.set(ip, visits);
      return { allowed: false, retryAfterSeconds: Math.ceil(((visits[0] ?? now) + this.windowMilliseconds - now) / 1_000) };
    }

    visits.push(now);
    this.visitsByIp.set(ip, visits);
    if (this.visitsByIp.size > 10_000) {
      for (const [key, values] of this.visitsByIp) {
        const latestVisit = values.at(-1);
        if (latestVisit !== undefined && latestVisit <= threshold) this.visitsByIp.delete(key);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
