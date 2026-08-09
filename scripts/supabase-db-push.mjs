#!/usr/bin/env node
/** Push tracked Supabase migrations using the local-only database connection. */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(repoRoot);

if (!process.env.SUPABASE_DB_URL) {
  throw new Error("缺少 SUPABASE_DB_URL；请仅在 Git 忽略的 .env.local 中配置。");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const extraArguments = process.argv.slice(2).filter((argument) => argument !== "--");
const child = spawn(
  command,
  ["dlx", "supabase", "db", "push", "--db-url", process.env.SUPABASE_DB_URL, "--include-all", ...extraArguments],
  { cwd: repoRoot, env: process.env, stdio: "inherit" },
);

child.once("error", (error) => {
  throw error;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
