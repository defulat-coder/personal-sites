# GitHub Star 同步与中文阅读版

`modules/github-starred/` 是独立的 GitHub Star 同步模块。它不会把完整 Star 列表或原始资料直接交给前端。

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| Star 元数据、README、仓库结构证据 | `data/sensitive/github/starred/raw/` | `public.github_starred_sources`（RLS 私有） | 否 |
| 官方中文 README 或 Kimi 生成的中文阅读版，以及 Kimi 的一句话简介 | `data/sensitive/github/starred/derived/` | `public.github_starred_analyses`（RLS 私有） | 否 |
| 已明确公开的单仓库双版本 Markdown | 不以本地文件为运行时来源 | `public.github_open_source_items`（RLS 公开只读） | 是 |

`github_starred_sources`、`github_starred_analyses` 与 `github_starred_curation` 位于 Supabase 的 `public` schema 是为了让 service-role 同步脚本通过 Data API 写入；三者均启用 RLS、撤销 `anon`/`authenticated` 权限且没有读取策略。`SUPABASE_SERVICE_ROLE_KEY` 只能由本地或部署侧脚本使用，不能进入浏览器或 `NEXT_PUBLIC_*` 环境变量。

详情页的“仓库结构”不是本地敏感副本：页面先从 Supabase 的公开投影确认该仓库已发布，再由服务器按需读取对应的公开 GitHub 仓库树和单个文本文件；浏览器永远不会得到 GitHub Token 或 Supabase service-role key。结果缓存 10 分钟，单文件预览上限 512 KB，二进制文件仅提供 GitHub 原文件链接。线上建议设置仅具公开仓库读取权限的 `GITHUB_TOKEN`，以避免 GitHub 匿名 API 限流。

## 执行

先运行 `pnpm supabase:push` 应用数据库迁移。首次初始化会读取当前全部 GitHub Star、保留本地敏感副本，并默认使用 Pi Coding Agent / Kimi 解析每个仓库：

```bash
pnpm github:starred:init
```

初始化可以中断后重跑：内容 SHA 未变化的仓库会复用本地中文阅读版和一句话简介。单次 Kimi 请求默认最多等待 4 分钟；超时仓库会记录失败但不会阻塞其余批次，下次运行可以继续处理。

每日增量任务会先分页读取当前 Star 元数据；仅新出现的仓库、默认分支变化的仓库，或 GitHub `updatedAt` 变化的仓库，才会重新读取 README。它会解析这些变更仓库，并自动补偿此前未完成或失败的历史解析；已完成且未变化的仓库不会再次调用 Kimi：

```bash
pnpm github:starred:daily
```

该任务必须在保存 GitHub 登录态、Kimi 凭据和 Supabase service-role key 的本机环境执行；不要放进前端或 Vercel。Codex 已配置为每天在本项目的本机环境运行它。Pi / Kimi 默认使用 15 并发；`--limit 20` 可用于小范围验证，`--only owner/repository` 可重试单个仓库，`--concurrency 10` 可临时限流。

## Codex CLI 备用引擎

默认路径始终是 Pi / Kimi。仅当显式传入 `--engine codex-cli` 时，才会使用本机已登录的 Codex CLI；默认并发为 1，避免同时启动大量 Agent 会话。该路径把与 Pi 相同的受限翻译/解析提示传给临时、无状态的 CLI 会话，CLI 以只读沙箱运行，最终文本先写入系统临时目录，再由本模块沿用原有的本地私有落盘与 Supabase 发布逻辑。

```bash
pnpm github:starred:analyze:codex
pnpm github:starred:analyze:codex -- --only owner/repository
```

可在 `config/github-sync.json` 的 `analysis.codex_cli` 中设置 `model`、`concurrency`、`request_timeout_ms` 与 `executable`。该方式会把待处理的 README/仓库结构发送给当前 Codex 账户所使用的模型；只在已获得这类资料外发授权时使用。日常定时任务不自动切换到 Codex CLI，仍保持 Pi / Kimi。

## 中文阅读版规则

README 存在时优先解析 README。若根目录存在仓库维护的中文 README（如 `README.zh-CN.md`、`README_CN.md`），它直接成为中文阅读版，不会调用 Kimi 翻译；源 README 本身为中文时也同样直接使用。没有官方中文 README 的英文 README 才经 Pi Coding Agent 调用 Kimi 翻译。README 缺失时读取根目录和可识别的入口/manifest 文件，生成带信息缺口说明的仓库解析。

Kimi 翻译时只翻译自然语言说明。代码块、行内代码、命令、路径、配置键、URL、Markdown 链接、仓库/产品/模型/协议名称，以及 `Skill`、`Agent`、`README`、`MCP`、`API`、`CLI`、`SDK`、`LLM`、`RAG` 等专业术语保持原样。模型不拥有工具权限，且输入 README 只作为不可信引用。若两次翻译仍无法完整保留这些内容，当前 Markdown 片段会保留原文，避免为了翻译丢失链接、代码或格式，也不会阻塞整个仓库的解析。

每个仓库还会生成一条中文一句话简介，用于开源关注列表的“仓库名称 + 简介”展示。即使采用仓库维护的中文 README，也只将 README 直接用作阅读版；一句话简介仍由 Pi Coding Agent 调用 Kimi 基于公开仓库资料生成。若单次 Kimi 响应为空或失败，系统会以公开的 GitHub description 生成简短兜底，保证初始化不中断；下次每日补偿仍会重新尝试 Kimi。简介与中文阅读版一起保存在本地派生目录和 Supabase 私有分析表；仅白名单中公开的仓库会将该简介投影到站点。

## 公开范围

`config/open-source-curation.mjs` 是已选择公开的仓库白名单和个人判读。同步程序会为所有 Star 创建私有草稿记录，但只有白名单中的仓库在已有中文阅读版后才生成公开投影。网站服务器只使用 publishable key 读取公开投影；它不会回退到本地敏感目录。
