import { z } from "zod";

import { getCurationPage } from "@/lib/curation";

const PUBLIC_CURATION_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

// 与 /api/ai-news 同理：分页档位固定为客户端的 PAGE_SIZE=20，limit 钳位、offset
// 向下取整到 20 的倍数，把 unstable_cache 的键组合收敛到有限档位，防止爬虫用
// 随机分页参数撑爆缓存。客户端按 id 去重，取整带来的重复条目会被丢弃。
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
    return Response.json(await getCurationPage(offset, PAGE_STEP), {
      headers: { "Cache-Control": PUBLIC_CURATION_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("读取策展分页失败", error);
    return Response.json({ error: "暂时无法加载更多策展内容。" }, { status: 500 });
  }
}
