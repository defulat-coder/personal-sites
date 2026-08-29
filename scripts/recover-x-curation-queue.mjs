#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareCurationItem } from "../modules/x-sync/analysis.mjs";
import { writeJsonAtomically } from "../modules/x-sync/queue-file.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repoRoot, "data/sensitive/x-curation");
const queuePath = path.join(root, "curation-queue.json");
const generatedPath = path.join(root, "generated/curation.json");
const rawRoot = path.join(root, "raw");

if (!process.argv.includes("--force")) {
  const queueStat = await stat(queuePath).catch(() => null);
  if (queueStat?.size) throw new Error("策展队列非空；如确认需要恢复，请显式传入 --force。");
}

function shortLinks(text) {
  return [...new Set(String(text ?? "").match(/https?:\/\/t\.co\/\w+/gu) ?? [])].map((url) => ({
    expanded: null,
    original: url,
    type: "unexpanded",
  }));
}

function mergeLinks(...groups) {
  const links = new Map();
  for (const link of groups.flat()) {
    const key = link.expanded ?? link.original;
    if (!key) continue;
    links.set(key, {
      expanded: link.expanded ?? link.url ?? null,
      original: link.original ?? link.shortUrl ?? null,
      type: link.type ?? "external",
    });
  }
  return [...links.values()];
}

const rawById = new Map();
const rawNames = (await readdir(rawRoot)).filter((name) => name.endsWith(".json")).sort();
for (const name of rawNames) {
  let value;
  try {
    value = JSON.parse(await readFile(path.join(rawRoot, name), "utf8"));
  } catch {
    continue;
  }
  for (const item of value.bookmarks ?? []) rawById.set(String(item.id), item);
  for (const tweet of value.tweets ?? []) {
    const id = String(tweet.id ?? "");
    if (!id) continue;
    const existing = rawById.get(id) ?? {};
    rawById.set(id, {
      ...existing,
      isQuote: Boolean(tweet.quotedTweet) || existing.isQuote,
      isReply: Boolean(tweet.inReplyToStatusId) || existing.isReply,
      links: mergeLinks(existing.links ?? [], shortLinks(tweet.text)),
      quoteContext: existing.quoteContext ?? (tweet.quotedTweet ? {
        author: tweet.quotedTweet.author?.username ?? "",
        authorName: tweet.quotedTweet.author?.name ?? "",
        text: tweet.quotedTweet.text ?? "",
      } : null),
      replyContext: existing.replyContext ?? null,
    });
  }
}

const generated = JSON.parse(await readFile(generatedPath, "utf8"));
const items = generated.items.map((item) => {
  const raw = rawById.get(String(item.id)) ?? {};
  const sourceKinds = item.facts?.sourceKinds ?? [];
  const fetchSource = sourceKinds.length > 0 ? sourceKinds.join("+") : "bookmark";
  return prepareCurationItem({
    ai: {
      analysis: item.analysis,
      design: item.design,
      enrichedAt: generated.generatedAt,
      searchSignals: item.searchSignals,
      summary: item.summary,
      tags: item.tags,
      title: item.title,
      visualFacts: item.visualFacts,
    },
    author: item.author,
    createdAt: item.publishedAt ?? "",
    fetchSource,
    firstSeenAt: item.collectedAt ?? undefined,
    firstSeenOrder: item.collectedOrder ?? undefined,
    id: String(item.id),
    isQuote: Boolean(raw.isQuote ?? item.quoteContext),
    isReply: Boolean(raw.isReply ?? item.facts?.contentType === "reply"),
    links: mergeLinks(item.links ?? [], raw.links ?? [], shortLinks(item.text)),
    media: item.media ?? [],
    quoteContext: raw.quoteContext ?? item.quoteContext ?? null,
    replyContext: raw.replyContext ?? null,
    text: item.text,
    tweetUrl: item.source.url,
  }, { now: generated.generatedAt });
});

if (items.length !== generated.items.length || items.length === 0) {
  throw new Error("恢复条目数量不完整，拒绝写入策展队列。");
}

await writeJsonAtomically(queuePath, {
  items,
  recoveredAt: new Date().toISOString(),
  recoverySource: "generated-public-projection+raw-evidence",
  updatedAt: new Date().toISOString(),
  version: 3,
});
console.log(`策展队列已恢复：${items.length} 条。`);
