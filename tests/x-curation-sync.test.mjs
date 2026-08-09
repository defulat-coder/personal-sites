import assert from "node:assert/strict";
import test from "node:test";

import { parseSyncArgs, runSyncPipeline } from "../scripts/x-curation-sync.mjs";
import { resolveKimiConfig } from "../scripts/lib/x-curation-ai.mjs";

test("sync pipeline fetches X data, prepares the sensitive queue, then enriches it", async () => {
  const calls = [];

  await runSyncPipeline({
    repoRoot: "/repo",
    options: parseSyncArgs(["--source", "likes", "--limit", "3", "--media"]),
    execute: async (command, args, options) => calls.push({ command, args, options }),
  });

  assert.deepEqual(calls, [
    {
      command: process.execPath,
      args: ["src/cli.js", "fetch", "--source", "likes", "--media"],
      options: {
        cwd: "/repo/tools/smaug",
        env: { BIRD_PATH: "/repo/node_modules/.bin/bird" },
      },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/x-curation-prepare.mjs", "--source=likes"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/x-curation-enrich.mjs", "--limit", "3"],
      options: { cwd: "/repo" },
    },
  ]);
});

test("both sources retain their own origin before Kimi enrichment", async () => {
  const calls = [];

  await runSyncPipeline({
    repoRoot: "/repo",
    options: parseSyncArgs(["--fetch-only"]),
    execute: async (command, args, options) => calls.push({ command, args, options }),
  });

  assert.deepEqual(calls.map((call) => call.args), [
    ["src/cli.js", "fetch", "--source", "bookmarks"],
    ["/repo/scripts/x-curation-prepare.mjs", "--source=bookmarks"],
    ["src/cli.js", "fetch", "--source", "likes"],
    ["/repo/scripts/x-curation-prepare.mjs", "--source=likes"],
  ]);
});

test("sync arguments accept pnpm's -- separator", () => {
  assert.deepEqual(parseSyncArgs(["--", "--source=bookmarks", "--fetch-only"]), {
    source: "bookmarks",
    limit: null,
    media: false,
    fetchOnly: true,
  });
});

test("Kimi is the default analysis provider and keeps legacy API variables compatible", () => {
  const resolved = resolveKimiConfig({
    config: {},
    env: { X_CURATION_API_KEY: "legacy-key" },
  });

  assert.deepEqual(resolved, {
    provider: "kimi",
    apiKey: "legacy-key",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2-0905-preview",
  });
});
