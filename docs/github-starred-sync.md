# GitHub Star 同步与中文阅读版

`modules/github-starred/` 是独立的 GitHub Star 同步模块。它不会把完整 Star 列表或原始资料直接交给前端。

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| Star 元数据、README、仓库结构证据 | `data/sensitive/github/starred/raw/` | `public.github_starred_sources`（RLS 私有） | 否 |
| 官方中文 README 或 Kimi 生成的中文阅读版 | `data/sensitive/github/starred/derived/` | `public.github_starred_analyses`（RLS 私有） | 否 |
| 已明确公开的单仓库双版本 Markdown | 不以本地文件为运行时来源 | `public.github_open_source_items`（RLS 公开只读） | 是 |

`github_starred_sources`、`github_starred_analyses` 与 `github_starred_curation` 位于 Supabase 的 `public` schema 是为了让 service-role 同步脚本通过 Data API 写入；三者均启用 RLS、撤销 `anon`/`authenticated` 权限且没有读取策略。`SUPABASE_SERVICE_ROLE_KEY` 只能由本地或部署侧脚本使用，不能进入浏览器或 `NEXT_PUBLIC_*` 环境变量。

## 执行

先运行 `pnpm supabase:push` 应用数据库迁移。首次全量同步与解析执行：

```bash
pnpm github:starred:run
```

日常可拆分执行：

```bash
pnpm github:starred:sync
pnpm github:starred:analyze
pnpm github:starred:publish
```

所有命令默认处理全部仓库、使用 15 并发；`--limit 20` 可用于小范围验证，`--only owner/repository` 可重试单个仓库，`--concurrency 10` 可临时限流。同一仓库的源内容 SHA 未变时，解析会复用本地中文阅读版，因此中断后可直接重跑。

## 中文阅读版规则

README 存在时优先解析 README。若根目录存在仓库维护的中文 README（如 `README.zh-CN.md`、`README_CN.md`），它直接成为中文阅读版，不会调用 Kimi 翻译；源 README 本身为中文时也同样直接使用。没有官方中文 README 的英文 README 才经 Pi Coding Agent 调用 Kimi 翻译。README 缺失时读取根目录和可识别的入口/manifest 文件，生成带信息缺口说明的仓库解析。

Kimi 翻译时只翻译自然语言说明。代码块、行内代码、命令、路径、配置键、URL、Markdown 链接、仓库/产品/模型/协议名称，以及 `Skill`、`Agent`、`README`、`MCP`、`API`、`CLI`、`SDK`、`LLM`、`RAG` 等专业术语保持原样。模型不拥有工具权限，且输入 README 只作为不可信引用。

## 公开范围

`config/open-source-curation.mjs` 是已选择公开的仓库白名单和个人判读。同步程序会为所有 Star 创建私有草稿记录，但只有白名单中的仓库在已有中文阅读版后才生成公开投影。网站服务器只使用 publishable key 读取公开投影；它不会回退到本地敏感目录。
