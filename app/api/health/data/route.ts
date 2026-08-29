import { readDataHealth } from "@/lib/data-health.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await readDataHealth();
    return Response.json(health, {
      headers: { "Cache-Control": "no-store" },
      status: health.healthy ? 200 : 503,
    });
  } catch (error) {
    console.error("读取统一数据健康状态失败", error);
    return Response.json({ healthy: false }, { headers: { "Cache-Control": "no-store" }, status: 503 });
  }
}
