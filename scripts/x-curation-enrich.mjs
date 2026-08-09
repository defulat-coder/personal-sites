#!/usr/bin/env node
/**
 * x-curation-enrich.mjs
 *
 * 策展待审队列的 AI 解析程序。对待审核条目执行完整解析：
 *   1. 展开 t.co 短链并分类（github / article / 其他）
 *   2. 抓取链接内容：GitHub 仓库元数据 + 完整 README（gh CLI）；文章正文
 *   3. 可选：配图交给视觉模型读图
 *   4. 调用 OpenAI 兼容 API 生成 标题 / 摘要 / 标签 / 深度解析
 *   5. 写回待审队列（每条落盘，可断点续跑）
 *
 * 凭据从环境变量读取，不写入任何文件：
 *   X_CURATION_API_KEY   必填，API Key
 *   X_CURATION_BASE_URL  可选，默认 https://api.moonshot.cn/v1
 *   X_CURATION_MODEL     可选，默认 kimi-k2-0905-preview
 *   X_CURATION_VISION    可选，置 1 时把配图 URL 一并交给模型（需视觉模型）
 *
 * 用法：
 *   node scripts/x-curation-enrich.mjs              # 解析全部待处理条目
 *   node scripts/x-curation-enrich.mjs --limit 20   # 只处理前 20 条
 *   node scripts/x-curation-enrich.mjs --dry-run    # 只展开链接和抓内容，不调 API
 *   node scripts/x-curation-enrich.mjs --only <id>  # 只处理指定条目
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);
const queuePath = path.join(repoRoot, config.reviewQueueFile);

const API_KEY = process.env.X_CURATION_API_KEY ?? "";
const BASE_URL = (process.env.X_CURATION_BASE_URL ?? "https://api.moonshot.cn/v1").replace(/\/$/, "");
const MODEL = process.env.X_CURATION_MODEL ?? "kimi-k2-0905-preview";
const VISION = process.env.X_CURATION_VISION === "1";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : Infinity;
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",")) : null;

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

async function callModel(item, prompt) {
  const userContent = [{ type: "text", text: prompt }];
  if (VISION) {
    for (const media of item.media ?? []) {
      if (media.type === "photo" && media.url) {
        userContent.push({ type: "image_url", image_url: { url: media.url } });
      }
    }
    if (userContent.length > 1) {
      userContent[0].text += "\n\n另附推文配图，请在 analysis 末尾追加一节 **配图解析**，描述图片中可见的事实信息。";
    }
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: userContent }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body.slice(0, 200)}`);
  }
  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  if (!parsed.title || !parsed.summary || !parsed.analysis || !Array.isArray(parsed.tags)) {
    throw new Error("模型返回缺少必需字段");
  }
  return parsed;
}

// ---------- 主流程 ----------

const queue = JSON.parse(await readFile(queuePath, "utf8"));
let targets = queue.items.filter(
  (item) => item.review.status === "draft" && !item.ai.enrichedAt,
);
if (ONLY) targets = targets.filter((item) => ONLY.has(item.id));
targets = targets.slice(0, LIMIT);

console.log(`待解析: ${targets.length} 条${DRY_RUN ? "（dry-run，不调用 API）" : ""}`);
if (!DRY_RUN && !API_KEY) {
  console.error("缺少 X_CURATION_API_KEY 环境变量。");
  process.exit(1);
}

let done = 0;
let failed = 0;
for (const item of targets) {
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
      continue;
    }

    // 3. AI 解析（带一次重试）
    const prompt = buildPrompt(item, linkContents);
    let parsed;
    try {
      parsed = await callModel(item, prompt);
    } catch (firstError) {
      console.warn(`  首次调用失败（${firstError.message.slice(0, 80)}），5 秒后重试`);
      await sleep(5000);
      parsed = await callModel(item, prompt);
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
    await writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n"); // 每条落盘
    await sleep(1000); // 限速
  } catch (error) {
    failed += 1;
    console.error(`[失败] ${item.id}: ${error.message.slice(0, 120)}`);
    await writeFile(queuePath, JSON.stringify(queue, null, 2) + "\n");
    await sleep(2000);
  }
}

console.log(`\n完成: ${done} 条解析，${failed} 条失败（可重跑续传）`);
