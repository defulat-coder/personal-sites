import { listWorks } from "@/lib/works";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    return Response.json(await listWorks(), { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    console.error("读取本地构建档案失败", error);
    return Response.json({ error: "暂时无法加载构建档案。" }, { status: 500 });
  }
}
