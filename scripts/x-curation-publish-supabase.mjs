#!/usr/bin/env node
/** 将本机敏感策展备份同步到 Supabase；网站不读取本地备份。 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { publishQueueToSupabase } from "../modules/x-sync/publish-to-supabase.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(repoRoot);
const config = JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"));
const queue = JSON.parse(await readFile(path.join(repoRoot, config.queueFile), "utf8"));
const result = await publishQueueToSupabase(queue);

console.log(`Supabase 同步完成：私有备份 ${result.privateCount} 条，公开策展 ${result.publicCount} 条。`);
