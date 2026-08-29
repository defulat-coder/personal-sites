import { readAiNewsCronHealth } from "@/lib/ai-news-sync.server";
import { toPublicAiNewsHealth } from "@/modules/ai-news/public-health.mjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = toPublicAiNewsHealth(await readAiNewsCronHealth());
    return Response.json(health, {
      headers: { "Cache-Control": "no-store" },
      status: health.healthy ? 200 : 503,
    });
  } catch (error) {
    console.error("读取每日动态健康状态失败", error);
    return Response.json(
      { healthy: false },
      {
        headers: { "Cache-Control": "no-store" },
        status: 503,
      },
    );
  }
}
