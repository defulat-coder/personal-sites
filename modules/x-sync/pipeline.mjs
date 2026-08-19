import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import path from "node:path";

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const outputDescriptor = options.stdoutPath ? openSync(options.stdoutPath, "w", 0o600) : null;
    let outputClosed = false;
    const closeOutput = () => {
      if (outputDescriptor !== null && !outputClosed) {
        closeSync(outputDescriptor);
        outputClosed = true;
      }
    };
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["inherit", outputDescriptor ?? "inherit", "inherit"],
    });
    child.once("error", (error) => {
      closeOutput();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      closeOutput();
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`));
    });
  });
}

export async function runSyncPipeline({
  repoRoot,
  options,
  captureSourceOrder,
  env = process.env,
  execute = runCommand,
}) {
  const smaugRoot = path.join(repoRoot, "tools/smaug");
  const birdPath = env.BIRD_PATH ?? path.join(repoRoot, "node_modules/.bin/bird");
  const sources = options.source === "both" ? ["bookmarks", "likes"] : [options.source];

  for (const source of sources) {
    const sourceOrderPath = captureSourceOrder ? await captureSourceOrder(source) : null;
    const fetchArgs = ["src/cli.js", "fetch", "--source", source];
    if (options.media) fetchArgs.push("--media");
    await execute(process.execPath, fetchArgs, { cwd: smaugRoot, env: { BIRD_PATH: birdPath } });
    const prepareArgs = [path.join(repoRoot, "scripts/x-curation-prepare.mjs"), `--source=${source}`];
    if (sourceOrderPath) prepareArgs.push(`--source-order-file=${sourceOrderPath}`);
    await execute(
      process.execPath,
      prepareArgs,
      { cwd: repoRoot },
    );
  }
  if (options.fetchOnly) return;

  const enrichArgs = [path.join(repoRoot, "scripts/x-curation-enrich.mjs")];
  if (options.engine === "codex-cli") {
    enrichArgs.push("--engine", "codex-cli", "--model", options.codexModel, "--reasoning-effort", options.reasoningEffort);
  }
  if (options.limit !== null) enrichArgs.push("--limit", String(options.limit));
  await execute(process.execPath, enrichArgs, { cwd: repoRoot });
  await execute(process.execPath, [path.join(repoRoot, "scripts/build-curation-content.mjs")], { cwd: repoRoot });
  await execute(process.execPath, [path.join(repoRoot, "scripts/build-curation-sqlite.mjs")], { cwd: repoRoot });
}

export async function runHistoryPipeline({ repoRoot, birdPath, credentials, execute = runCommand }) {
  const rawDir = path.join(repoRoot, "data/sensitive/x-curation/raw");
  const env = { AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 };
  const sources = [
    { command: "bookmarks", output: "bookmarks-all.json" },
    { command: "likes", output: "likes-all.json" },
  ];
  for (const source of sources) {
    await execute(birdPath, [source.command, "--all", "--json"], {
      cwd: repoRoot,
      env,
      stdoutPath: path.join(rawDir, source.output),
    });
  }
  await execute(process.execPath, [path.join(repoRoot, "scripts/x-curation-import-bird.mjs")], { cwd: repoRoot });
  await execute(process.execPath, [path.join(repoRoot, "scripts/build-curation-content.mjs")], { cwd: repoRoot });
  await execute(process.execPath, [path.join(repoRoot, "scripts/build-curation-sqlite.mjs")], { cwd: repoRoot });
}
