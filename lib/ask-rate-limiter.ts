export type AskRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class AskRateLimiter {
  private readonly visitsByIp = new Map<string, number[]>();

  constructor(
    private readonly maximumRequests = 50,
    private readonly windowMilliseconds = 10 * 60 * 1_000,
    private readonly maximumTrackedIps = 50_000,
  ) {}

  check(ip: string, now = Date.now()): AskRateLimitResult {
    const threshold = now - this.windowMilliseconds;
    // 删除后重插，让 Map 的插入序始终反映最近使用序，供下方硬上限按 LRU 驱逐。
    const existing = this.visitsByIp.get(ip);
    if (existing !== undefined) this.visitsByIp.delete(ip);
    const visits = (existing ?? []).filter((timestamp) => timestamp > threshold);
    if (visits.length >= this.maximumRequests) {
      this.visitsByIp.set(ip, visits);
      return { allowed: false, retryAfterSeconds: Math.ceil(((visits[0] ?? now) + this.windowMilliseconds - now) / 1_000) };
    }

    visits.push(now);
    this.visitsByIp.set(ip, visits);
    // 硬上限：伪造来源制造的条目全部“新鲜”，按“出窗才删”永远清不掉；
    // 超出上限时驱逐最久未访问的键，保证 Map 不无界增长。
    while (this.visitsByIp.size > this.maximumTrackedIps) {
      const oldest = this.visitsByIp.keys().next().value;
      if (oldest === undefined) break;
      this.visitsByIp.delete(oldest);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
