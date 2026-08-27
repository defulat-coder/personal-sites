import { getOpenSourceEntry } from "@/lib/open-source";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";
type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const entry = await getOpenSourceEntry((await context.params).slug);
    return entry
      ? Response.json(entry, { headers: { "Cache-Control": CACHE_CONTROL } })
      : Response.json({ error: "没有找到这条开源关注。" }, { status: 404 });
  } catch (error) {
    console.error("读取本地开源关注详情失败", error);
    return Response.json({ error: "暂时无法加载开源关注详情。" }, { status: 500 });
  }
}
