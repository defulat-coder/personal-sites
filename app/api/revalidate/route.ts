import { createHash, timingSafeEqual } from "node:crypto";

import { revalidatePath, revalidateTag } from "next/cache";

// 每日动态同步（GitHub Actions 定时任务）完成后的按需失效入口：
// 同步脚本写入 Supabase 公开投影后调用本路由，下一次访问即拿到新数据，
// 不再等 ISR / unstable_cache 自然过期。密钥只在服务端环境变量配置。
export async function POST(request: Request) {
  const secret = process.env.AI_NEWS_REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "服务端未配置 AI_NEWS_REVALIDATE_SECRET。" }, { status: 503 });
  }
  // 哈希后做常量时间比较，避免逐字节比较泄露时序。
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const token = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(token), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "未授权。" }, { status: 401 });
  }

  // webhook 场景需要立即过期（而非 stale-while-revalidate 的 "max"），
  // 否则失效后的第一次访问仍会先拿到旧页面。
  revalidateTag("public-ai-news", { expire: 0 });
  revalidatePath("/");
  revalidatePath("/ai-news");
  revalidatePath("/ai-news/[id]", "page");
  return Response.json({ revalidated: true, now: Date.now() });
}
