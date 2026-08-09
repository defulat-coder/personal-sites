#!/usr/bin/env node
/**
 * x-curation-import-bird.mjs
 *
 * 把 bird CLI 全量拉取的原始数据（书签 + 点赞）批量导入策展队列。
 * 用于初始化同步；日常增量仍走 smaug → x-curation-prepare.mjs。
 *
 * bird 原始格式比 smaug 精简：链接不展开（保留 t.co 原文，解析阶段再展开），
 * 但带互动数据（likeCount/retweetCount/replyCount）可用于策展优先级排序。
 *
 * 用法：
 *   node scripts/x-curation-import-bird.mjs
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergeXMedia, normalizeXMedia } from "../modules/x-sync/media.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);

const rawDir = path.join(repoRoot, config.rawDir);
const queuePath = path.join(repoRoot, config.queueFile);

const SOURCES = [
  { file: path.join(rawDir, "bookmarks-all.json"), fetchSource: "bookmark" },
  { file: path.join(rawDir, "likes-all.json"), fetchSource: "like" },
  { dir: path.join(rawDir, "likes-chunks"), fetchSource: "like" },
];

function extractShortLinks(text) {
  const urls = text.match(/https?:\/\/t\.co\/\w+/gu) ?? [];
  return [...new Set(urls)].map((url) => ({
    original: url,
    expanded: null,
    type: "unexpanded",
  }));
}

function toInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeTweet(tweet, fetchSource) {
  const handle = tweet.author?.username ?? "";
  return {
    id: String(tweet.id),
    fetchSource,
    author: {
      handle,
      name: tweet.author?.name ?? "",
    },
    text: tweet.text ?? "",
    tweetUrl: handle ? `https://x.com/${handle}/status/${tweet.id}` : "",
    createdAt: tweet.createdAt ?? "",
    links: extractShortLinks(tweet.text ?? ""),
    media: Array.isArray(tweet.media) ? tweet.media.map(normalizeXMedia) : [],
    isQuote: Boolean(tweet.quotedTweet),
    quoteContext: tweet.quotedTweet
      ? {
          id: String(tweet.quotedTweet.id ?? ""),
          author: tweet.quotedTweet.author?.username ?? "",
          authorName: tweet.quotedTweet.author?.name ?? "",
          text: tweet.quotedTweet.text ?? "",
        }
      : null,
    isReply: Boolean(tweet.inReplyToStatusId),
    replyContext: null,
    engagement: {
      likes: toInt(tweet.likeCount),
      retweets: toInt(tweet.retweetCount),
      replies: toInt(tweet.replyCount),
    },
    ai: {
      title: "",
      summary: "",
      tags: [],
      analysis: "",
      enrichedAt: null,
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

// 读取全部来源
const tweets = [];
for (const source of SOURCES) {
  if (source.file) {
    const data = await readJsonOr(source.file, { tweets: [] });
    for (const tweet of data.tweets ?? []) tweets.push({ tweet, fetchSource: source.fetchSource });
  } else {
    let files = [];
    try {
      files = (await readdir(source.dir)).filter((name) => name.endsWith(".json")).sort();
    } catch { /* 目录不存在则跳过 */ }
    for (const file of files) {
      const data = await readJsonOr(path.join(source.dir, file), { tweets: [] });
      for (const tweet of data.tweets ?? []) tweets.push({ tweet, fetchSource: source.fetchSource });
    }
  }
}

const queue = await readJsonOr(queuePath, { version: 2, items: [] });
const existing = new Set(queue.items.map((item) => item.id));
const seen = new Set(existing);

let added = 0;
let duplicated = 0;
let bothSources = 0;
for (const { tweet, fetchSource } of tweets) {
  const id = String(tweet.id);
  if (seen.has(id)) {
    duplicated += 1;
    // 同一条同时出现在书签和点赞：补充来源标记
    const item = queue.items.find((candidate) => candidate.id === id);
    if (item && item.fetchSource !== fetchSource && !item.fetchSource.includes(fetchSource)) {
      item.fetchSource = `${item.fetchSource}+${fetchSource}`;
      bothSources += 1;
    }
    if (item) item.media = mergeXMedia(item.media, tweet.media ?? []);
    continue;
  }
  const entry = normalizeTweet(tweet, fetchSource);
  queue.items.unshift(entry);
  seen.add(id);
  added += 1;
}

queue.updatedAt = new Date().toISOString();
await mkdir(path.dirname(queuePath), { recursive: true });
await writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");

console.log(`来源总量: ${tweets.length} 条（书签 + 点赞）`);
console.log(`新增策展条目: ${added} 条`);
console.log(`去重跳过: ${duplicated} 条（其中 ${bothSources} 条同时存在于书签和点赞，已合并标记）`);
console.log(`队列总量: ${queue.items.length} 条`);
