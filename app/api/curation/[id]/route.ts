import { findCurationItem } from "@/lib/curation";

const PUBLIC_CURATION_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

type RouteContext = { params: Promise<{ id: string }> };

// 策展详情的 JSON 出口：供 iOS App 读取（页面详情仍走服务端渲染，不经此路由）。
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const item = await findCurationItem(id);
    if (!item) {
      return Response.json({ error: "没有找到这条策展。" }, { status: 404 });
    }
    return Response.json(item, {
      headers: { "Cache-Control": PUBLIC_CURATION_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("读取策展详情失败", error);
    return Response.json({ error: "暂时无法加载策展详情。" }, { status: 500 });
  }
}
