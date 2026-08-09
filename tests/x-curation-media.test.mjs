import assert from "node:assert/strict";
import test from "node:test";

import { mergeXMedia, normalizeXMedia } from "../modules/x-sync/media.mjs";

test("media normalization retains direct video playback details", () => {
  assert.deepEqual(normalizeXMedia({
    durationMs: 12_000,
    height: 720,
    previewUrl: "https://pbs.twimg.com/media/preview.jpg",
    type: "video",
    url: "https://pbs.twimg.com/media/cover.jpg",
    videoUrl: "https://video.twimg.com/video.mp4",
    width: 1280,
  }), {
    durationMs: 12_000,
    height: 720,
    previewUrl: "https://pbs.twimg.com/media/preview.jpg",
    type: "video",
    url: "https://pbs.twimg.com/media/cover.jpg",
    videoUrl: "https://video.twimg.com/video.mp4",
    width: 1280,
  });
});

test("media merge backfills a direct video URL without dropping the current media", () => {
  assert.deepEqual(mergeXMedia([
    { height: 720, previewUrl: null, type: "video", url: "https://pbs.twimg.com/media/cover.jpg", width: 1280 },
  ], [
    { durationMs: 12_000, type: "video", url: "https://pbs.twimg.com/media/cover.jpg", videoUrl: "https://video.twimg.com/video.mp4" },
  ]), [
    {
      durationMs: 12_000,
      height: 720,
      previewUrl: null,
      type: "video",
      url: "https://pbs.twimg.com/media/cover.jpg",
      videoUrl: "https://video.twimg.com/video.mp4",
      width: 1280,
    },
  ]);
});
