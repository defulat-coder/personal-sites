import assert from "node:assert/strict";
import test from "node:test";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import {
  buildCurationPrompt,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toReviewItem,
} from "../modules/douyin-sync/import.mjs";
import { parseArgs, settleConcurrently } from "../scripts/douyin-curation.mjs";
import { parseFullSyncArgs } from "../scripts/douyin-full-sync.mjs";

test("Douyin manifest and analyzer output form an auditable review item", () => {
  const [record] = parseDownloadManifest(`${JSON.stringify({
    author_name: "作者",
    author_sec_uid: "sec-id",
    aweme_id: "123",
    desc: "介绍一个项目",
    file_paths: ["作者/collect/demo.mp4"],
    media_type: "video",
    publish_timestamp: 1_700_000_000,
    recorded_at: "2026-08-23T10:00:00.000Z",
  })}\n`);
  const video = toDouyinVideo(record, "/downloads");
  const evidence = parseAnalyzerOutput({
    metadata: { title: "demo" },
    ocrResults: [{ confidence: 90, text: "Example Project", time: "0:03" }],
    timeline: [{ ocrText: "Example Project", time: "0:03", transcript: "今天介绍它" }],
    transcript: [{ text: "今天介绍它", time: "0:03" }],
    warnings: [],
  });
  const parsed = parseCurationResponse(JSON.stringify({
    analysis: "**是什么**\n\n解析内容",
    excerpt: "今天介绍它",
    mentionedProjects: [{
      description: "视频中的项目",
      evidence: [{ channel: "ocr", text: "Example Project", time: "0:03" }],
      kind: "tool",
      name: "Example Project",
    }],
    summary: "摘要",
    tags: ["AI 应用"],
    title: "值得留意的示例项目",
  }));
  parsed.ai.excerpt = groundEvidenceExcerpt("Example Project", evidence);
  const item = toReviewItem(video, parsed, "data/sensitive/douyin-curation/raw/123/analysis.json");

  assert.equal(video.videoPath, "/downloads/作者/collect/demo.mp4");
  assert.match(buildCurationPrompt(video, evidence, ["AI 应用"]), /屏幕文字 OCR/u);
  assert.equal(item.review.approved, false);
  assert.equal(item.ai.excerpt, "Example Project");
  assert.equal(item.mentionedProjects[0].verification, "unresolved");
  assert.throws(() => toPublicDouyinItem(item), /尚未批准/u);

  item.review.approved = true;
  const publicItem = toPublicDouyinItem(item);
  assert.equal(publicItem.id, "douyin-123");
  assert.deepEqual(publicItem.source, {
    label: "抖音视频",
    platform: "douyin",
    url: "https://www.douyin.com/video/123",
  });
});

test("Douyin importer rejects malformed or evidence-free input", () => {
  assert.throws(() => parseDownloadManifest("not-json\n"), /第 1 行/u);
  assert.throws(() => parseAnalyzerOutput({ ocrResults: [], transcript: [] }), /没有得到语音转写或屏幕文字/u);
  assert.deepEqual(parseArgs(["sync", "--manifest", "downloads/download_manifest.jsonl", "--limit", "5"]), {
    analyzerConcurrency: null,
    concurrency: null,
    engine: "codex-cli",
    force: false,
    ids: [],
    limit: 5,
    manifest: "downloads/download_manifest.jsonl",
    stage: "sync",
  });
  assert.deepEqual(parseFullSyncArgs(["--skip-download", "--analyze-limit", "20"]), {
    analyze: true,
    analyzeLimit: 20,
    analyzerConcurrency: 6,
    concurrency: 20,
    download: false,
    engine: "codex-cli",
  });
});

test("Douyin worker pool records one failure without stopping later work", async () => {
  const completed = [];
  const failures = await settleConcurrently([1, 2, 3], 2, async (value) => {
    if (value === 2) throw new Error("broken");
    completed.push(value);
  });

  assert.deepEqual(completed.sort(), [1, 3]);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].target, 2);
  assert.match(failures[0].error.message, /broken/u);
});
