import { getOpenSourceListEntries } from "@/lib/open-source";

const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET() {
  try {
    return Response.json(await getOpenSourceListEntries(), { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    console.error("读取本地开源关注列表失败", error);
    return Response.json({ error: "暂时无法加载开源关注。" }, { status: 500 });
  }
}
