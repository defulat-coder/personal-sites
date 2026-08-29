import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ai-news-sync.server", () => ({
  authorizeAiNewsCron: vi.fn(),
  readAiNewsCronHealth: vi.fn(),
  runAiNewsCron: vi.fn(),
}));

const syncModule = await import("../lib/ai-news-sync.server");
const { POST } = await import("../app/api/cron/ai-news/route");
const { GET: healthGET } = await import("../app/api/health/ai-news/route");

const authorizeMock = vi.mocked(syncModule.authorizeAiNewsCron);
const healthMock = vi.mocked(syncModule.readAiNewsCronHealth);
const runMock = vi.mocked(syncModule.runAiNewsCron);

describe("AI news Cron routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects requests without the Vault-backed bearer token", async () => {
    authorizeMock.mockResolvedValue(false);
    const response = await POST(
      new Request("https://example.com/api/cron/ai-news", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(runMock).not.toHaveBeenCalled();
  });

  it("runs an authorized incremental sync without caching", async () => {
    authorizeMock.mockResolvedValue(true);
    runMock.mockResolvedValue({
      backfill: false,
      modes: {},
      publicCount: 0,
      skipped: false,
    });
    const response = await POST(
      new Request("https://example.com/api/cron/ai-news", {
        body: JSON.stringify({ backfill: false }),
        headers: {
          authorization: "Bearer cron-secret",
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(runMock).toHaveBeenCalledWith(false);
  });

  it("reports stale synchronization as unhealthy", async () => {
    healthMock.mockResolvedValue({
      ageMinutes: 25,
      healthy: false,
      lastError: null,
      lastStartedAt: null,
      lastSucceededAt: "2026-08-29T00:00:00.000Z",
      running: false,
    });
    const response = await healthGET();

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ageMinutes: 25,
      healthy: false,
    });
  });
});
