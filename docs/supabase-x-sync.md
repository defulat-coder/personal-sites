# X 同步与本地 SQLite

`modules/x-sync/` 是 X 数据同步的独立模块，包含抓取/导入后的编排和公开 SQLite 投影生成。它不替代本地备份：本机仍保留原始抓取文件、策展队列和生成后的 JSON，全部位于被 Git 忽略的 `data/sensitive/x-curation/`。

同步后的职责如下：

| 数据 | 本地 | Git | 网站读取 |
| --- | --- | --- | --- |
| 原始 X 抓取与完整队列 | `data/sensitive/x-curation/` | 禁止 | 否 |
| Pi/Kimi 或 Codex CLI 生成结果 | `data/sensitive/x-curation/` | 禁止 | 否 |
| 已完成解析且已公开的统一每日关注内容 | `data/curation.sqlite` | 提交 | 是 |

## 配置

X 数据解析默认复用本机 Codex CLI 登录态，不需要额外模型密钥。显式传入 `--engine pi` 或使用 Kimi 快捷命令时，才需要在被 Git 忽略的 `.env.local` 中配置：

```bash
KIMI_API_KEY=<kimi-key>
```

`data/curation.sqlite` 只能由本机 `scripts/build-curation-sqlite.mjs` 通过 `better-sqlite3` 从 X 策展队列与已批准的抖音待审队列生成。它是只读公开投影，不包含抓取快照、视频、转写、游标或凭据；Vercel 在部署中随 Git 文件读取，运行时不写入它。

抓取后的分析采用可版本化阶段：确定性事实提取、视觉理解、策展解析与设计分类分别记录状态、输入 hash、模型和版本。事实层不调用模型；视觉 OCR/场景、隐藏检索信号与编辑结果写回私有队列，公开投影只携带可公开的派生字段。相同媒体输入在条目内重跑时会复用已持久化的视觉事实。

私有队列与生成备份使用临时文件原子替换，进程中止不会截断现有 JSON。如果队列本身已经丢失或损坏，可在确认公开生成备份与原始证据完整后执行 `pnpm curation:recover -- --force` 重建；恢复命令默认拒绝覆盖非空队列。

## 初始化与同步

两类同步使用同一套 X 抓取、敏感备份和 SQLite 发布流程，仅解析引擎不同；Codex CLI 是默认引擎，Pi/Kimi 是显式备选：

```bash
# Codex CLI + GPT-5.6 Luna（默认；正文解析 Max 单并发，设计回填 High 40 并发）
pnpm curation:sync

# 显式改用 Pi Coding Agent + Kimi（15 并发）
pnpm curation:sync:kimi

# 只补“已有策展、缺少设计判断”的历史条目，不改写原解析
pnpm curation:classify-design

# 分批刷新旧条目的新版检索信号与视觉事实
pnpm curation:enrich -- --refresh --limit 20
```

同步命令可以在 `--` 后继续传 `--source`、`--limit`、`--design-concurrency` 或 `--no-media` 等公共参数，例如 `pnpm curation:sync -- --source bookmarks --limit 20`。媒体元数据默认抓取，供设计分类与站内视频播放使用；Codex 的历史设计回填默认使用已验证的 40 并发，可通过 `--design-concurrency` 降档。

1. 执行其中一个同步命令：抓取媒体与正文 → 为新条目生成完整策展及设计分类 → 只为已有解析但缺分类的历史条目补设计判断 → 本地敏感生成备份 → 生成 `data/curation.sqlite`。历史补分类不会重写已有标题、摘要、标签或深度解析。底层仍保留 `--engine codex-cli|pi`，用于显式切换解析引擎。
2. 只暂存 `data/curation.sqlite` 与本次明确的代码/文档变更，运行 `pnpm git:safety` 后提交并推送；Vercel 的 Git 集成会创建新部署。
3. `pnpm curation:publish` 只重建 SQLite，不会访问远端数据库；结束时固定报告设计收录、排除、待复核、未分类及可播放视频数量。

每次生成策展内容时还会在私有目录写入 `data/sensitive/x-curation/generated/insights.json`，包含数据健康度、来源分布、高频概念、工具、近期上升主题与 taxonomy 建议。该文件不会进入 Git 或网站运行时。

前端只在 Node.js 服务端从 SQLite 读取，绝不向浏览器暴露数据库文件。`next.config.ts` 的输出文件追踪会将它随每个函数部署；Edge Runtime 不支持这一读取路径。

`ask_documents` 同时维护 SQLite FTS5 索引；搜索文本包含标题、正文、引用、确定性事实、工具、语义检索信号和视觉 OCR。运行时优先使用 FTS5 排序，异常或短查询继续使用进程内子字符串评分。

## 设计相关性分类

模型解析每条 X 内容时，同时读取原文、引用、展开后的外链正文，以及最多 5 张图片或视频代表帧。视频帧只写入系统临时目录，判断结束立即删除；原视频、抽帧和私有队列都不会进入公开 SQLite。

分类输出包含 `relevant`、`confidence`、设计子类、证据和理由，由本地代码统一决策：置信度不低于 `0.75` 的相关内容进入 `/design`，同等置信度的不相关内容直接排除，低置信度的正反判断都留在私有队列等待复核。旧条目缺少分类时会在后续 `curation:enrich` / `curation:sync` 批次中重新解析，可用 `--limit` 分批回填。

## 迁移后的远端清理

旧 Supabase 的 X、策展与 Ask 表已经通过收敛迁移删除；当前流程不会再创建或写入这些结构。
