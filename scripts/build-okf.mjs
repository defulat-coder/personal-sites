#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { generateAgentHistoryBundle } from "./agent-history-to-okf.mjs";
import { generateGithubBundle } from "./github-to-okf.mjs";
import { generateBundle as generateYuqueBundle } from "./yuque-to-okf.mjs";
import {
  assertRegularFile,
  resolveInside,
  sha256,
  writeUtf8Exclusive as writeUtf8,
} from "./lib/private-file-integrity.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

async function loadJsonFile(file, root, label) {
  await assertRegularFile(file, root, label);
  const bytes = await readFile(file);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function sourceDate(value) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configPath = resolveInside(PROJECT_ROOT, "config/okf.json", "config");
  const { value: config } = await loadJsonFile(configPath, PROJECT_ROOT, "config");
  if (config.schema_version !== "1.0.0" || config.okf_version !== "0.1") throw new Error("okf-config-unsupported");

  const yuqueRawRoot = resolveInside(PROJECT_ROOT, config.input?.yuque_raw_root, "yuque-raw-root");
  const githubRawRoot = resolveInside(PROJECT_ROOT, config.input?.github_raw_root, "github-raw-root");
  const agentHistoryRawRoot = resolveInside(PROJECT_ROOT, config.input?.agent_history_raw_root, "agent-history-raw-root");
  const outputRoot = resolveInside(PROJECT_ROOT, config.output?.bundle_root, "output-root");
  const outputRelative = path.relative(PROJECT_ROOT, outputRoot);
  if (!outputRelative.startsWith(`knowledge${path.sep}private${path.sep}`)) throw new Error("output-must-be-private-knowledge");

  const yuqueManifestFile = resolveInside(yuqueRawRoot, "manifest.json", "yuque-manifest");
  const yuqueCoverageFile = resolveInside(yuqueRawRoot, "coverage.json", "yuque-coverage");
  const githubManifestFile = resolveInside(githubRawRoot, "manifest.json", "github-manifest");
  const agentHistoryManifestFile = resolveInside(agentHistoryRawRoot, "manifest.json", "agent-history-manifest");
  const yuqueManifest = await loadJsonFile(yuqueManifestFile, yuqueRawRoot, "yuque-manifest");
  const yuqueCoverage = await loadJsonFile(yuqueCoverageFile, yuqueRawRoot, "yuque-coverage");
  const githubManifest = await loadJsonFile(githubManifestFile, githubRawRoot, "github-manifest");
  const agentHistoryManifest = await loadJsonFile(agentHistoryManifestFile, agentHistoryRawRoot, "agent-history-manifest");
  if (yuqueManifest.value.schema_version !== "1.0.0" || yuqueCoverage.value.schema_version !== "1.0.0") {
    throw new Error("yuque-raw-schema-unsupported");
  }
  if (JSON.stringify(yuqueManifest.value.coverage) !== JSON.stringify(yuqueCoverage.value)) {
    throw new Error("yuque-manifest-coverage-mismatch");
  }
  if (githubManifest.value.schema_version !== "1.0.0" || githubManifest.value.source_system !== "github") {
    throw new Error("github-raw-schema-unsupported");
  }
  if (githubManifest.value.complete !== true) throw new Error("github-raw-incomplete");
  if (agentHistoryManifest.value.schema_version !== "1.0.0" || agentHistoryManifest.value.source_system !== "agent-history") {
    throw new Error("agent-history-raw-schema-unsupported");
  }
  if (agentHistoryManifest.value.complete !== true) throw new Error("agent-history-raw-incomplete");

  const yuqueManifestSha = sha256(yuqueManifest.bytes);
  const githubManifestSha = sha256(githubManifest.bytes);
  const agentHistoryManifestSha = sha256(agentHistoryManifest.bytes);
  const parent = path.dirname(outputRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const stagingRoot = `${outputRoot}.staging-${randomUUID()}`;
  const backupRoot = `${outputRoot}.backup-${randomUUID()}`;
  await mkdir(stagingRoot, { recursive: false, mode: 0o700 });
  let movedExisting = false;
  try {
    const yuqueCounts = await generateYuqueBundle({
      config,
      rawRoot: yuqueRawRoot,
      stagingRoot,
      manifest: yuqueManifest.value,
      coverage: yuqueCoverage.value,
      manifestSha: yuqueManifestSha,
      includeRootDocuments: false,
    });
    const githubCounts = await generateGithubBundle({
      config,
      rawRoot: githubRawRoot,
      stagingRoot,
      manifest: githubManifest.value,
      manifestBytes: githubManifest.bytes,
    });
    const agentHistoryCounts = await generateAgentHistoryBundle({
      config,
      rawRoot: agentHistoryRawRoot,
      stagingRoot,
      manifest: agentHistoryManifest.value,
      manifestBytes: agentHistoryManifest.bytes,
    });
    const snapshotDate = [
      sourceDate(githubManifest.value.snapshot_at),
      sourceDate(githubCounts.snapshot_timestamp),
      sourceDate(agentHistoryManifest.value.snapshot_at),
      sourceDate(agentHistoryCounts.snapshot_timestamp),
    ].filter(Boolean).sort().at(-1) ?? "1970-01-01";
    const rootIndex = `---\nokf_version: "0.1"\n---\n\n# 陈远个人知识 Bundle\n\n这是由私有 Raw 数据确定性生成的完整 OKF v0.1 Knowledge Bundle。它不是网站公开内容。\n\n# Collections\n\n* [语雀个人知识](yuque/) - 完整文档、小记、去重与复核队列。\n* [GitHub 项目知识](github/) - 自有、Starred、Watched 仓库及关系历史。\n* [Codex 与 Claude Code 历史](agent-history/) - 会话、持久记忆、提示历史与项目索引。\n\n# Reports\n\n* [语雀整理报告](yuque/curation-report.md) - 正文去重、质量分层与人工复核摘要。\n* [GitHub 整理报告](github/curation-report.md) - 仓库去重、项目角色边界与增量更新摘要。\n* [Agent 历史整理报告](agent-history/curation-report.md) - Raw 完整性、可读投影、隐私与增量更新边界。\n`;
    await writeUtf8(stagingRoot, "index.md", rootIndex);
    await writeUtf8(stagingRoot, "log.md", `# Knowledge Bundle Update Log\n\n## ${snapshotDate}\n\n* **Bundle**: Rebuilt the private OKF v0.1 bundle atomically from source manifests.\n* **Yuque**: Raw manifest \`${yuqueManifestSha}\`; ${yuqueCounts.documents} documents and ${yuqueCounts.notes} notes.\n* **GitHub**: Raw manifest \`${githubManifestSha}\`; ${githubCounts.repositories} stable repositories, ${githubCounts.active} active and ${githubCounts.inactive} inactive.\n* **Agent History**: Raw manifest \`${agentHistoryManifestSha}\`; ${agentHistoryCounts.conversations} conversations, ${agentHistoryCounts.memories} memories and ${agentHistoryCounts.messages} readable messages.\n* **Privacy**: Kept the generated bundle under \`knowledge/private/\`; publishing remains a separate approval step.\n`);
    await writeUtf8(stagingRoot, "bundle.json", `${JSON.stringify({
      schema_version: "1.0.0",
      okf_version: "0.1",
      snapshot_date: snapshotDate,
      sources: {
        yuque: { manifest_sha256: yuqueManifestSha, coverage_complete: Boolean(yuqueCoverage.value.complete), counts: yuqueCounts },
        github: { manifest_sha256: githubManifestSha, complete: true, counts: githubCounts },
        agent_history: { manifest_sha256: agentHistoryManifestSha, complete: true, counts: agentHistoryCounts },
      },
    }, null, 2)}\n`);

    try {
      const existing = await lstat(outputRoot);
      if (!existing.isDirectory() || existing.isSymbolicLink()) throw new Error("output-not-directory");
      await rename(outputRoot, backupRoot);
      movedExisting = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(stagingRoot, outputRoot);
    if (movedExisting) await rm(backupRoot, { recursive: true, force: true });
    process.stdout.write(`${JSON.stringify({
      okf_version: "0.1",
      output: path.relative(PROJECT_ROOT, outputRoot),
      sources: {
        yuque: { manifest_sha256: yuqueManifestSha, ...yuqueCounts },
        github: { manifest_sha256: githubManifestSha, ...githubCounts },
        agent_history: { manifest_sha256: agentHistoryManifestSha, ...agentHistoryCounts },
      },
    })}\n`);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    if (movedExisting) await rename(backupRoot, outputRoot).catch(() => {});
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch((error) => {
    const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
    process.stderr.write(`[build-okf] fatal=${JSON.stringify(reason)}\n`);
    process.exitCode = 1;
  });
}

export { main };
