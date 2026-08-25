import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { normalizeDesignClassification, summarizeDesignClassifications } from "../modules/x-sync/design-classification.mjs";
import { collectDesignEvidenceImages } from "../modules/x-sync/design-media.mjs";

test("design classification separates relevance from confidence", () => {
  const base = {
    categories: ["交互设计"],
    evidence: ["视频展示界面状态切换"],
    reason: "主要价值来自交互方式。",
    relevant: true,
  };
  const included = normalizeDesignClassification({ ...base, confidence: 0.75 }, "2026-08-25T00:00:00.000Z");
  const review = normalizeDesignClassification({ ...base, confidence: 0.6 }, "2026-08-25T00:00:00.000Z");
  const excluded = normalizeDesignClassification({ ...base, confidence: 0.9, relevant: false }, "2026-08-25T00:00:00.000Z");
  const uncertainExclusion = normalizeDesignClassification({ ...base, confidence: 0.6, relevant: false }, "2026-08-25T00:00:00.000Z");

  assert.equal(included.status, "include");
  assert.equal(review.status, "review");
  assert.equal(excluded.status, "exclude");
  assert.equal(uncertainExclusion.status, "review");
  assert.throws(
    () => normalizeDesignClassification({ ...base, categories: ["漂亮视频"], confidence: 0.9 }),
    /未知分类/u,
  );
});

test("video evidence samples representative frames and removes temporary files", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "x-design-test-"));
  const calls = [];
  try {
    const evidence = await collectDesignEvidenceImages([{
      durationMs: 10_000,
      type: "video",
      videoUrl: "https://video.twimg.com/ext_tw_video/example.mp4",
    }], {
      execute: async (command, args) => {
        calls.push({ args, command });
        await writeFile(args.at(-1), "frame", "utf8");
      },
      temporaryDirectory,
    });

    assert.equal(evidence.images.length, 3);
    assert.deepEqual(calls.map((call) => call.command), ["ffmpeg", "ffmpeg", "ffmpeg"]);
    assert.deepEqual(calls.map((call) => call.args[3]), ["1.500", "5.000", "8.500"]);
    const [firstImage] = evidence.images;
    assert.equal(firstImage.data, Buffer.from("frame").toString("base64"));
    assert.equal(existsSync(firstImage.path), true);

    await evidence.cleanup();
    assert.equal(existsSync(firstImage.path), false);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("design publication summary reports decisions and directly playable videos", () => {
  const item = (status, videoUrl = null) => ({
    design: status ? { status } : null,
    media: videoUrl ? [{ videoUrl }] : [],
  });
  assert.deepEqual(summarizeDesignClassifications([
    item("include", "https://video.twimg.com/a.mp4"),
    item("include"),
    item("exclude"),
    item("review"),
    item(null),
  ]), {
    exclude: 1,
    include: 2,
    playableVideos: 1,
    review: 1,
    unclassified: 1,
  });
});
