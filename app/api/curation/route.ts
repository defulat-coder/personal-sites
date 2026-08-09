import { z } from "zod";

import { getCurationPage } from "@/lib/curation";

const PUBLIC_CURATION_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return Response.json({ error: "分页参数无效。" }, { status: 400 });
  }

  try {
    return Response.json(await getCurationPage(query.data.offset, query.data.limit), {
      headers: { "Cache-Control": PUBLIC_CURATION_CACHE_CONTROL },
    });
  } catch (error) {
    console.error("读取策展分页失败", error);
    return Response.json({ error: "暂时无法加载更多策展内容。" }, { status: 500 });
  }
}
