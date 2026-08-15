// 临时脚本：在 Supabase 公开投影 x_curation_items 中检索 motion 相关条目。
// 只读取 .env.local 中的公开连接信息，不打印任何凭据。
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const base = env.SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) {
  console.error("缺少 SUPABASE_URL 或 SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const url = new URL(`${base}/rest/v1/x_curation_items`);
url.searchParams.set("select", "id,content");
url.searchParams.set("order", "published_at.desc.nullslast");
url.searchParams.set("limit", "1000");

const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) {
  console.error(`查询失败：${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();
console.error(`共拉取 ${rows.length} 条公开策展条目`);

const pattern = /motion|动效|动画|animat|transition|手势|交互设计|interaction|prototype|framer|gsap|spring|lottie|micro-?interaction|微交互|缓动|easing/iu;

const hits = [];
for (const row of rows) {
  const c = row.content ?? {};
  const haystack = [c.title, c.summary, c.text, c.analysis, ...(c.tags ?? [])]
    .filter(Boolean)
    .join("\n");
  if (pattern.test(haystack)) {
    hits.push({
      id: row.id,
      title: c.title,
      author: c.author?.handle,
      publishedAt: c.publishedAt,
      tags: c.tags,
      summary: c.summary,
      tweetUrl: c.tweetUrl,
      matched: [...new Set(haystack.match(new RegExp(pattern.source, "giu")) ?? [])].slice(0, 5),
    });
  }
}

console.log(JSON.stringify(hits, null, 2));
