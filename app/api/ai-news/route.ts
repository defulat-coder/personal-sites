import { z } from "zod";

import { getAiNewsPage } from "@/lib/ai-news";

const PUBLIC_AI_NEWS_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

// 分页档位固定为客户端的 PAGE_SIZE=50：limit 钳到 50、offset 向下取整到 50 的倍数。
// 客户端本身只按 50 步长翻页且按 id 去重，钳位对真实用户无感知；但可以把
// CDN 缓存键（响应头 s-maxage）收敛到有限档位，避免爬虫用随机分页参数
// 绕过 CDN、每个 miss 都打一次 Supabase。
const PAGE_STEP = 50;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(PAGE_STEP),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return Response.json({ error: "分页参数无效。" }, { status: 400 });
  }

  const offset = Math.floor(query.data.offset / PAGE_STEP) * PAGE_STEP;
  try {
    return Response.json(await getAiNewsPage(offset, PAGE_STEP), {
      headers: { "Cache-Control": PUBLIC_AI_NEWS_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("读取每日动态分页失败", error);
    return Response.json({ error: "暂时无法加载更多每日动态。" }, { status: 500 });
  }
}
