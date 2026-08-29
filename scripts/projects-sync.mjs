#!/usr/bin/env node
/** 按项目增量采集证据、生成待审草稿，并在显式批准后发布公开快照。 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { projectCatalog } from "../config/project-catalog.mjs";
import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import { createCodexCliReader, createKimiReader } from "../modules/github-starred/analysis.mjs";
import { approveProjectDraft, deriveProjectDraft, PROJECT_EXTRACTOR_VERSION } from "../modules/project-sync/derive.mjs";
import { publishApprovedProject } from "../modules/project-sync/publish.mjs";
import {
  collectProjectEvidence,
  projectSyncPaths,
  readJson,
  resolveProjectRoots,
  writePrivateJson,
} from "../modules/project-sync/source.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(repoRoot);

export function parseProjectSyncArgs(args) {
  const options = { approve: false, dryRun: false, engine: DEFAULT_ANALYSIS_ENGINE, force: false, projects: null, publish: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--approve") options.approve = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--force") options.force = true;
    else if (argument === "--publish") options.publish = true;
    else if (argument === "--engine") options.engine = args[++index] ?? "";
    else if (argument === "--project") options.projects = new Set((args[++index] ?? "").split(",").filter(Boolean));
    else throw new Error(`未知参数：${argument}`);
  }
  options.engine = resolveAnalysisEngine(options.engine);
  if (options.projects?.size === 0) throw new Error("--project 至少需要一个项目 ID。");
  if (options.dryRun && (options.approve || options.publish)) throw new Error("--dry-run 不能与 --approve 或 --publish 同时使用。");
  return options;
}

const options = parseProjectSyncArgs(process.argv.slice(2));
const projects = (await resolveProjectRoots(projectCatalog, repoRoot)).filter(
  (project) => !options.projects || options.projects.has(project.id),
);
if (projects.length === 0) throw new Error("没有匹配的项目。");

let readerPromise;
function getReader() {
  readerPromise ??= options.engine === "codex-cli"
    ? createCodexCliReader({
        config: { analysis: { codex_cli: { reasoning_effort: "high", request_timeout_ms: 240000 } } },
        repoRoot,
      })
    : createKimiReader({ config: { analysis: { request_timeout_ms: 240000 } }, repoRoot });
  return readerPromise;
}

const totals = { approved: 0, changed: 0, failed: 0, projects: projects.length, published: 0, records: 0, reused: 0 };

for (const project of projects) {
  const paths = projectSyncPaths(repoRoot, project.id);
  try {
    const evidenceSnapshot = await collectProjectEvidence(project);
    const previousState = (await readJson(paths.state)) ?? {};
    const changed = options.force || previousState.sourceDigest !== evidenceSnapshot.sourceDigest;
    console.log(`[${project.id}] 证据 ${evidenceSnapshot.evidence.length} 条，${changed ? "发现变化" : "没有变化"}。`);
    if (options.dryRun) {
      totals[changed ? "changed" : "reused"] += 1;
      continue;
    }
    await writePrivateJson(paths.evidence, evidenceSnapshot);
    await writePrivateJson(paths.state, {
      ...previousState,
      evidenceCount: evidenceSnapshot.evidence.length,
      extractorVersion: PROJECT_EXTRACTOR_VERSION,
      sourceDigest: evidenceSnapshot.sourceDigest,
      sourceObservedAt: evidenceSnapshot.sourceObservedAt,
    });
    const existingDraft = await readJson(paths.draft);
    const needsDerive = options.force
      || changed
      || !existingDraft
      || existingDraft.extractorVersion !== PROJECT_EXTRACTOR_VERSION;
    const reader = needsDerive ? await getReader() : null;
    const { draft, reused } = await deriveProjectDraft({
      evidenceSnapshot,
      force: options.force,
      paths,
      project,
      prompt: reader?.prompt,
    });
    totals[reused ? "reused" : "changed"] += 1;
    totals.records += draft.records.length;
    console.log(`[${project.id}] 草稿 ${draft.records.length} 条${reused ? "（复用）" : "（已更新）"}。`);
    if (options.approve) {
      await approveProjectDraft(paths, project);
      totals.approved += 1;
      console.log(`[${project.id}] 已批准当前草稿。`);
    }
    if (options.publish) {
      const result = await publishApprovedProject({ paths, project });
      totals.published += 1;
      console.log(`[${project.id}] 已发布 ${result.recordCount} 条，修订 ${result.revision.slice(0, 12)}。`);
    }
  } catch (error) {
    totals.failed += 1;
    console.error(`[${project.id}] 失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`项目同步完成：项目 ${totals.projects}，变化 ${totals.changed}，复用 ${totals.reused}，记录 ${totals.records}，批准 ${totals.approved}，发布 ${totals.published}，失败 ${totals.failed}。`);
if (totals.published > 0 && totals.failed === 0) {
  const { rebuildDefaultIndex } = await import("./local-vectors.mjs");
  await rebuildDefaultIndex();
}
if (totals.failed > 0) process.exitCode = 1;
