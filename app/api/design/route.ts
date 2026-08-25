import { z } from "zod";

import { getDesignCurationPage } from "@/lib/curation";

const PAGE_STEP = 20;
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(PAGE_STEP),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return Response.json({ error: "分页参数无效。" }, { status: 400 });

  const offset = Math.floor(query.data.offset / PAGE_STEP) * PAGE_STEP;
  try {
    return Response.json(await getDesignCurationPage(offset, PAGE_STEP), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("读取设计收藏分页失败", error);
    return Response.json({ error: "暂时无法加载更多设计收藏。" }, { status: 500 });
  }
}
