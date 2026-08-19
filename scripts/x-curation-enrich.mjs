#!/usr/bin/env node
/**
 * x-curation-enrich.mjs
 *
 * 策展队列的本地模型解析程序。对未解析条目执行完整解析：
 *   1. 展开 t.co 短链并分类（github / article / 其他）
 *   2. 抓取链接内容：GitHub 仓库元数据 + 完整 README（gh CLI）；文章正文
 *   3. Pi/Kimi 或显式选择的 Codex CLI 生成标题 / 摘要 / 标签 / 深度解析
 *   4. 写回策展队列（每条落盘，可断点续跑）
 *
 * 凭据从环境变量读取，不写入任何文件：
 *   KIMI_API_KEY         Pi/Kimi 路径必填
 *   PI_MODEL             Pi/Kimi 路径可选，默认 kimi-for-coding
 *
 * 用法：
 *   node scripts/x-curation-enrich.mjs                    # 以默认 15 并发解析全部待处理条目
 *   node scripts/x-curation-enrich.mjs --concurrency 10   # 调整并发数
 *   node scripts/x-curation-enrich.mjs --limit 20         # 只处理前 20 条
 *   node scripts/x-curation-enrich.mjs --engine codex-cli --model gpt-5.6-luna --reasoning-effort max
 *   node scripts/x-curation-enrich.mjs --dry-run          # 只展开链接和抓内容，不调用模型
 *   node scripts/x-curation-enrich.mjs --only <id>        # 只处理指定条目
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import { createCodexCliReader } from "../modules/github-starred/analysis.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";
import { resolvePiModelConfig } from "./lib/x-curation-ai.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);
const queuePath = path.join(repoRoot, config.queueFile);

loadLocalEnv(repoRoot);
const piModel = resolvePiModelConfig({ config, env: process.env });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const engineIdx = args.indexOf("--engine");
const ENGINE = engineIdx >= 0 ? args[engineIdx + 1] : "pi";
const codexModelIdx = args.indexOf("--model");
const CODEX_MODEL = codexModelIdx >= 0 ? args[codexModelIdx + 1] : "gpt-5.6-luna";
const reasoningEffortIdx = args.indexOf("--reasoning-effort");
const CODEX_REASONING_EFFORT = reasoningEffortIdx >= 0 ? args[reasoningEffortIdx + 1] : "max";
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : Infinity;
const concurrencyIdx = args.indexOf("--concurrency");
const CONCURRENCY = concurrencyIdx >= 0 ? Number.parseInt(args[concurrencyIdx + 1], 10) : ENGINE === "codex-cli" ? 1 : 15;
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1) {
  throw new Error("--concurrency 必须是大于 0 的整数。");
}
if (!new Set(["pi", "codex-cli"]).has(ENGINE)) {
  throw new Error("--engine 仅支持 pi 或 codex-cli。");
}
if (ENGINE === "codex-cli" && CONCURRENCY !== 1) {
  throw new Error("Codex CLI 解析必须使用 --concurrency 1，避免并发启动多个本机会话。");
}

const README_CAP = 12_000;
const ARTICLE_CAP = 8_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- 短链展开 ----------

async function expandUrl(shortUrl) {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sIL", "-o", "/dev/null", "-w", "%{url_effective}", "--max-time", "15", shortUrl],
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function classifyUrl(url) {
  if (/github\.com\/[\w.-]+\/[\w.-]+/u.test(url)) return "github";
  if (/x\.com\/i\/article\//u.test(url)) return "x-article";
  return "article";
}

// ---------- 内容抓取 ----------

async function fetchGithubRepo(url) {
  const match = /github\.com\/([\w.-]+\/[\w.-]+)/u.exec(url);
  if (!match) return null;
  const fullName = match[1].replace(/\.git$/u, "");
  try {
    const [meta, readme] = await Promise.all([
      execFileAsync("gh", ["api", `repos/${fullName}`]),
      execFileAsync("gh", [
        "api", `repos/${fullName}/readme`,
        "-H", "Accept: application/vnd.github.raw",
      ]),
    ]);
    const metaJson = JSON.parse(meta.stdout);
    return {
      fullName,
      description: metaJson.description ?? "",
      stars: metaJson.stargazers_count ?? 0,
      language: metaJson.language ?? "",
      createdAt: metaJson.created_at ?? "",
      pushedAt: metaJson.pushed_at ?? "",
      readme: readme.stdout.slice(0, README_CAP),
      readmeTruncated: readme.stdout.length > README_CAP,
    };
  } catch {
    return null;
  }
}

async function fetchArticleText(url) {
  try {
    const { stdout } = await execFileAsync("curl", [
      "-sL", "--max-time", "20",
      "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      url,
    ]);
    return stdout
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]+>/gu, " ")
      .replace(/&nbsp;/gu, " ").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, ARTICLE_CAP);
  } catch {
    return null;
  }
}

// ---------- AI 调用 ----------

function buildPrompt(item, linkContents) {
  const linkSection = linkContents
    .map((link) => {
      if (link.repo) {
        const r = link.repo;
        return `【GitHub 仓库 ${r.fullName}】\n描述: ${r.description}\nStars: ${r.stars} | 语言: ${r.language} | 创建: ${r.createdAt?.slice(0, 10)} | 最近提交: ${r.pushedAt?.slice(0, 10)}\nREADME（${r.readmeTruncated ? "已截断" : "完整"}）:\n${r.readme}`;
      }
      if (link.article) return `【文章 ${link.expanded}】\n正文（可能不完整）:\n${link.article}`;
      return `【链接】${link.original}（无法获取内容）`;
    })
    .join("\n\n");

  return `你是一位资深工程师（11 年经验，专注 Agent 工程与全栈架构）的策展助手。请为他在 X（Twitter）上${item.fetchSource.includes("bookmark") ? "收藏" : "点赞"}的以下内容生成策展解析。

【原推文】@${item.author.handle}（${item.author.name}）
${item.text}
${item.quoteContext ? `\n【被引用的推文】@${item.quoteContext.author}（${item.quoteContext.authorName}）\n${item.quoteContext.text}` : ""}
${linkSection ? `\n${linkSection}` : ""}

请严格输出如下 JSON（不要输出任何其他内容）：
{
  "title": "中文标题，点明内容主体和核心价值，20 字左右",
  "summary": "中文一句话摘要，50 字以内",
  "tags": ["从以下分类中选 1-2 个：${config.taxonomy.join("、")}"],
  "analysis": "中文深度解析，Markdown 格式。分节加粗小标题（如 **是什么**/**核心设计**/**关键洞察**/**边界与风险**）。若涉及 GitHub 仓库：还原它是什么、架构与核心设计、值得借鉴的亮点、坑与边界，事实必须来自上方 README 与元数据，不确定的不要编。若是文章：提炼核心论点链条。若是纯观点推文：展开其背景与意义。300-500 字。"
}`;
}

function parseJsonResponse(responseText) {
  const body = responseText.trim().replace(/^```(?:json)?\s*/u, "").replace(/\s*```$/u, "");
  const parsed = JSON.parse(body);
  if (!parsed.title || !parsed.summary || !parsed.analysis || !Array.isArray(parsed.tags) || parsed.tags.length === 0) {
    throw new Error("模型返回缺少必需字段");
  }
  return parsed;
}

async function callPiModel(prompt, runtime) {
  const model = runtime.getModel(piModel.provider, piModel.model);
  if (!model) throw new Error(`Pi 未找到模型：${piModel.provider}/${piModel.model}`);

  const resourceLoader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir: getAgentDir(),
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
  });
  await resourceLoader.reload();
  const { session } = await createAgentSession({
    cwd: repoRoot,
    model,
    modelRuntime: runtime,
    noTools: "all",
    resourceLoader,
    sessionManager: SessionManager.inMemory(repoRoot),
    thinkingLevel: "off",
  });
  let answer = "";
  const unsubscribe = session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      answer += event.assistantMessageEvent.delta;
    }
  });
  try {
    await session.prompt(prompt);
    return parseJsonResponse(answer);
  } finally {
    unsubscribe();
    session.dispose();
  }
}

// ---------- 主流程 ----------

const queue = JSON.parse(await readFile(queuePath, "utf8"));
let targets = queue.items.filter((item) => !item.ai.enrichedAt);
if (ONLY) targets = targets.filter((item) => ONLY.has(item.id));
targets = targets.slice(0, LIMIT);

console.log(`待解析: ${targets.length} 条，并发 ${CONCURRENCY}${DRY_RUN ? "（dry-run，不调用模型）" : ""}`);
if (!DRY_RUN && ENGINE === "pi" && !process.env.KIMI_API_KEY) {
  console.error("缺少 KIMI_API_KEY 环境变量，Pi 无法使用 Kimi Coding 模型。");
  process.exit(1);
}
const runtime = DRY_RUN || ENGINE === "codex-cli" ? null : await ModelRuntime.create({ allowModelNetwork: false });
const codexReader = !DRY_RUN && ENGINE === "codex-cli"
  ? await createCodexCliReader({
    config: { analysis: { codex_cli: { model: CODEX_MODEL, reasoning_effort: CODEX_REASONING_EFFORT } } },
    repoRoot,
  })
  : null;

async function callModel(prompt) {
  if (codexReader) return parseJsonResponse(await codexReader.prompt(prompt));
  return callPiModel(prompt, runtime);
}

let done = 0;
let failed = 0;
let nextTargetIndex = 0;
let saveQueue = Promise.resolve();

function persistQueue() {
  const snapshot = JSON.stringify(queue, null, 2) + "\n";
  saveQueue = saveQueue.then(() => writeFile(queuePath, snapshot));
  return saveQueue;
}

async function processItem(item) {
  try {
    // 1. 展开短链
    for (const link of item.links) {
      if (link.type !== "unexpanded") continue;
      const expanded = await expandUrl(link.original);
      if (expanded) {
        link.expanded = expanded;
        link.type = classifyUrl(expanded);
      }
      await sleep(300);
    }

    // 2. 抓取链接内容
    const linkContents = [];
    for (const link of item.links) {
      if (link.type === "github" && link.expanded) {
        const repo = await fetchGithubRepo(link.expanded);
        linkContents.push({ ...link, repo });
      } else if ((link.type === "article" || link.type === "x-article") && link.expanded) {
        const article = await fetchArticleText(link.expanded);
        linkContents.push({ ...link, article });
      }
    }

    if (DRY_RUN) {
      const expanded = item.links.filter((l) => l.expanded).length;
      const repos = linkContents.filter((l) => l.repo).length;
      const articles = linkContents.filter((l) => l.article).length;
      console.log(`[dry-run] ${item.id} @${item.author.handle}: 展开 ${expanded}/${item.links.length} 链接，仓库 ${repos}，文章 ${articles}`);
      done += 1;
      return;
    }

    // 3. AI 解析（带一次重试）
    const prompt = buildPrompt(item, linkContents);
    let parsed;
    try {
      parsed = await callModel(prompt);
    } catch (firstError) {
      console.warn(`  首次调用失败（${firstError.message.slice(0, 80)}），5 秒后重试`);
      await sleep(5000);
      parsed = await callModel(prompt);
    }

    item.ai = {
      title: String(parsed.title),
      summary: String(parsed.summary),
      tags: parsed.tags.map(String).slice(0, 2),
      analysis: String(parsed.analysis),
      enrichedAt: new Date().toISOString(),
    };

    done += 1;
    console.log(`[${done}/${targets.length}] ${item.id} → ${item.ai.title}`);
    await persistQueue(); // 每条落盘，按完成顺序串行写入
    await sleep(1000); // 限速
  } catch (error) {
    failed += 1;
    console.error(`[失败] ${item.id}: ${error.message.slice(0, 120)}`);
    await persistQueue();
    await sleep(2000);
  }
}

async function worker() {
  while (true) {
    const index = nextTargetIndex;
    nextTargetIndex += 1;
    if (index >= targets.length) return;
    await processItem(targets[index]);
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
await saveQueue;

console.log(`\n完成: ${done} 条解析，${failed} 条失败（可重跑续传）`);
if (failed > 0) process.exitCode = 1;
