import assert from "node:assert/strict";
import test from "node:test";

import { parseSyncArgs, runHistoryPipeline, runSyncPipeline } from "../scripts/x-curation-sync.mjs";
import { resolvePiModelConfig } from "../scripts/lib/x-curation-ai.mjs";

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
    {
      command: process.execPath,
      args: ["/repo/scripts/build-curation-content.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/build-curation-sqlite.mjs"],
      options: { cwd: "/repo" },
    },
  ]);
});

test("both sources retain their own origin before Pi Agent enrichment", async () => {
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

test("sync pipeline passes the captured X list order to the queue preparation step", async () => {
  const calls = [];

  await runSyncPipeline({
    repoRoot: "/repo",
    options: parseSyncArgs(["--source", "bookmarks", "--fetch-only"]),
    captureSourceOrder: async (source) => `/private/${source}-order.json`,
    execute: async (command, args, options) => calls.push({ command, args, options }),
  });

  assert.deepEqual(calls.map((call) => call.args), [
    ["src/cli.js", "fetch", "--source", "bookmarks"],
    [
      "/repo/scripts/x-curation-prepare.mjs",
      "--source=bookmarks",
      "--source-order-file=/private/bookmarks-order.json",
    ],
  ]);
});

test("sync arguments accept pnpm's -- separator", () => {
  assert.deepEqual(parseSyncArgs(["--", "--source=bookmarks", "--fetch-only"]), {
    source: "bookmarks",
    limit: null,
    media: false,
    fetchOnly: true,
    history: false,
    engine: "pi",
    codexModel: "gpt-5.6-luna",
    reasoningEffort: "max",
  });
});

test("sync arguments pass the requested Luna Max configuration to the single-threaded Codex parser", async () => {
  const calls = [];
  await runSyncPipeline({
    repoRoot: "/repo",
    options: parseSyncArgs(["--source", "bookmarks", "--engine", "codex-cli", "--model", "gpt-5.6-luna", "--reasoning-effort", "max"]),
    execute: async (command, args, options) => calls.push({ command, args, options }),
  });

  assert.deepEqual(calls[2].args, [
    "/repo/scripts/x-curation-enrich.mjs",
    "--engine", "codex-cli",
    "--model", "gpt-5.6-luna",
    "--reasoning-effort", "max",
  ]);
});

test("history pipeline uses bird pagination directly and imports both raw sources", async () => {
  const calls = [];

  await runHistoryPipeline({
    repoRoot: "/repo",
    birdPath: "/repo/node_modules/.bin/bird",
    credentials: { authToken: "token", ct0: "csrf" },
    execute: async (command, args, options) => calls.push({ command, args, options }),
  });

  assert.deepEqual(calls, [
    {
      command: "/repo/node_modules/.bin/bird",
      args: ["bookmarks", "--all", "--json"],
      options: {
        cwd: "/repo",
        env: { AUTH_TOKEN: "token", CT0: "csrf" },
        stdoutPath: "/repo/data/sensitive/x-curation/raw/bookmarks-all.json",
      },
    },
    {
      command: "/repo/node_modules/.bin/bird",
      args: ["likes", "--all", "--json"],
      options: {
        cwd: "/repo",
        env: { AUTH_TOKEN: "token", CT0: "csrf" },
        stdoutPath: "/repo/data/sensitive/x-curation/raw/likes-all.json",
      },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/x-curation-import-bird.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/build-curation-content.mjs"],
      options: { cwd: "/repo" },
    },
    {
      command: process.execPath,
      args: ["/repo/scripts/build-curation-sqlite.mjs"],
      options: { cwd: "/repo" },
    },
  ]);
});

test("Pi Coding Agent defaults to Kimi and permits explicit Pi model overrides", () => {
  const resolved = resolvePiModelConfig({
    config: { ai: { provider: "kimi-coding" } },
    env: { PI_MODEL: "kimi-custom", PI_MODEL_PROVIDER: "another-provider" },
  });

  assert.deepEqual(resolved, {
    provider: "kimi-coding",
    model: "kimi-custom",
  });
});
