# X 同步与本地 SQLite

`modules/x-sync/` 是 X 数据同步的独立模块，包含抓取/导入后的编排和公开 SQLite 投影生成。它不替代本地备份：本机仍保留原始抓取文件、策展队列和生成后的 JSON，全部位于被 Git 忽略的 `data/sensitive/x-curation/`。

同步后的职责如下：

| 数据 | 本地 | Git | 网站读取 |
| --- | --- | --- | --- |
| 原始 X 抓取与完整队列 | `data/sensitive/x-curation/` | 禁止 | 否 |
| Pi/Kimi 或 Codex CLI 生成结果 | `data/sensitive/x-curation/` | 禁止 | 否 |
| 已完成解析且已公开的策展内容 | `data/curation.sqlite` | 提交 | 是 |

## 配置

在被 Git 忽略的 `.env.local` 中配置 Kimi（默认路径）与本地 X 抓取凭据。显式使用 Codex CLI 时复用本机 Codex 登录态；X SQLite 流程不需要任何 Supabase 凭据：

```bash
KIMI_API_KEY=<kimi-key>
```

`data/curation.sqlite` 只能由本机 `scripts/build-curation-sqlite.mjs` 通过 `better-sqlite3` 从敏感队列生成。它是只读公开投影，不包含抓取快照、游标或凭据；Vercel 在部署中随 Git 文件读取，运行时不写入它。

## 初始化与同步

两类同步使用同一套 X 抓取、敏感备份和 SQLite 发布流程，仅解析引擎不同：

```bash
# Pi Coding Agent + Kimi（默认 15 并发）
pnpm curation:sync:kimi

# Codex CLI + GPT-5.6 Luna（Max，固定单并发）
pnpm curation:sync:luna
```

两个命令都可以在 `--` 后继续传 `--source`、`--limit` 或 `--media` 等公共参数，例如 `pnpm curation:sync:luna -- --source bookmarks --limit 20`。

1. 执行其中一个同步命令：抓取、解析、本地敏感生成备份、`data/curation.sqlite` 生成。底层仍保留 `pnpm curation:sync -- --engine pi|codex-cli`，用于需要自定义模型或推理等级的场景。
2. 只暂存 `data/curation.sqlite` 与本次明确的代码/文档变更，运行 `pnpm git:safety` 后提交并推送；Vercel 的 Git 集成会创建新部署。
3. `pnpm curation:publish` 只重建 SQLite，不会访问远端数据库。

前端只在 Node.js 服务端从 SQLite 读取，绝不向浏览器暴露数据库文件。`next.config.ts` 的输出文件追踪会将它随每个函数部署；Edge Runtime 不支持这一读取路径。

## 迁移后的远端清理

确认 SQLite 版本已在 Vercel 正常部署并可读后，可一次性执行 `pnpm curation:purge:supabase`，删除旧的 `x_sync_items`、`x_curation_items` 与 `daily` 问答索引副本。该命令不可逆，不能在新部署验证之前执行。
