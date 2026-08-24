import { z } from "zod";

import { getDouyinCurationPage } from "@/lib/curation";

const PUBLIC_CURATION_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

// 与 /api/curation 同一套分页语义：limit 钳位、offset 向下取整到 20 的倍数；
// 读同一份随部署打包的本地 sqlite，只是来源收窄为抖音。
const PAGE_STEP = 20;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(PAGE_STEP),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return Response.json({ error: "分页参数无效。" }, { status: 400 });
  }

  const offset = Math.floor(query.data.offset / PAGE_STEP) * PAGE_STEP;
  try {
    return Response.json(await getDouyinCurationPage(offset, PAGE_STEP), {
      headers: { "Cache-Control": PUBLIC_CURATION_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("读取抖音收藏分页失败", error);
    return Response.json({ error: "暂时无法加载更多策展内容。" }, { status: 500 });
  }
}
