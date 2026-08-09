#!/usr/bin/env node
/**
 * x-curation-prepare.mjs
 *
 * 把 smaug 抓取的 X 书签/点赞原始数据（pending-bookmarks.json）转换为
 * 策展待审队列（review-queue.json）。
 *
 * 管道位置：smaug fetch → 【本脚本】→ AI 打标/点评草稿 → 人工批准 → 公开投影
 *
 * 职责：
 * 1. 把 smaug pending 文件按内容快照保存到 data/sensitive/x-curation/raw/（证据层）
 * 2. 归一化为策展条目，按 tweet id 去重合并进待审队列
 * 3. 新条目状态为 draft，ai 字段留空，由 AI 打标步骤填充
 *
 * 用法：
 *   node scripts/x-curation-prepare.mjs [--source bookmarks|likes|both]
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);

const sourceArgIndex = process.argv.findIndex((arg) => arg === "--source");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const fetchSource = sourceArg
  ? sourceArg.split("=")[1]
  : sourceArgIndex >= 0
    ? process.argv[sourceArgIndex + 1]
    : "bookmarks";
if (!['bookmarks', 'likes', 'both'].includes(fetchSource)) {
  throw new Error("--source 只能是 bookmarks、likes 或 both。");
}

const pendingPath = path.join(repoRoot, config.smaugPendingFile);
const rawDir = path.join(repoRoot, config.rawDir);
const queuePath = path.join(repoRoot, config.reviewQueueFile);

function normalizeLink(link) {
  return {
    original: link.original ?? null,
    expanded: link.expanded ?? null,
    type: link.type ?? "external",
  };
}

function normalizeEntry(bookmark) {
  return {
    id: String(bookmark.id),
    fetchSource,
    author: {
      handle: bookmark.author ?? "",
      name: bookmark.authorName ?? "",
    },
    text: bookmark.text ?? "",
    tweetUrl: bookmark.tweetUrl ?? "",
    createdAt: bookmark.createdAt ?? "",
    links: Array.isArray(bookmark.links) ? bookmark.links.map(normalizeLink) : [],
    media: Array.isArray(bookmark.media)
      ? bookmark.media.map((m) => ({
          type: m.type ?? "photo",
          url: m.url ?? null,
          previewUrl: m.previewUrl ?? null,
          width: m.width ?? null,
          height: m.height ?? null,
        }))
      : [],
    isQuote: Boolean(bookmark.isQuote),
    quoteContext: bookmark.quoteContext ?? null,
    isReply: Boolean(bookmark.isReply),
    replyContext: bookmark.replyContext ?? null,
    ai: {
      title: "",
      summary: "",
      tags: [],
      analysis: "", // 深度解析：GitHub 仓库完整解析 / 文章观点提炼
      enrichedAt: null,
    },
    review: {
      status: "draft", // draft → approved | rejected
      note: "",
      reviewedAt: null,
    },
  };
}

async function readJsonOr(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const pending = JSON.parse(await readFile(pendingPath, "utf8"));
const bookmarks = Array.isArray(pending.bookmarks) ? pending.bookmarks : [];
if (bookmarks.length === 0) {
  console.log("smaug pending 文件为空，没有需要处理的条目。");
  process.exit(0);
}

// 1. Raw 证据快照（内容寻址，重复运行不产生新文件）
await mkdir(rawDir, { recursive: true });
const rawBody = JSON.stringify(pending);
const rawHash = createHash("sha256").update(rawBody).digest("hex");
const rawPath = path.join(rawDir, `${rawHash}.json`);
await writeFile(rawPath, rawBody);

// 2. 合并进待审队列（按 tweet id 去重，已审核条目不覆盖）
const queue = await readJsonOr(queuePath, { version: 1, items: [] });
const existing = new Map(queue.items.map((item) => [item.id, item]));

let added = 0;
for (const bookmark of bookmarks) {
  const id = String(bookmark.id);
  if (existing.has(id)) continue;
  const entry = normalizeEntry(bookmark);
  queue.items.unshift(entry); // 新的在前
  existing.set(id, entry);
  added += 1;
}

queue.updatedAt = new Date().toISOString();
await mkdir(path.dirname(queuePath), { recursive: true });
await writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");

const pendingReview = queue.items.filter((item) => item.review.status === "draft").length;
console.log(`Raw 快照: ${path.relative(repoRoot, rawPath)}`);
console.log(`新增待审条目: ${added}（队列共 ${queue.items.length} 条，其中 ${pendingReview} 条待审核）`);
console.log(`队列文件: ${path.relative(repoRoot, queuePath)}`);
if (added > 0) {
  console.log("下一步：AI 打标并生成点评草稿（填充 ai 字段），然后人工审核。");
}
