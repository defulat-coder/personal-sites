# GitHub Star 同步与中文阅读版

`modules/github-starred/` 是独立的 GitHub Star 同步模块。它不会把完整 Star 列表或原始资料直接交给前端。

| 数据 | 本地 | 网站读取 |
| --- | --- | --- |
| Star 元数据、README、仓库结构证据 | `data/sensitive/github/starred/raw/` | 否 |
| 官方中文 README 或模型生成的中文阅读版，以及一句话简介 | `data/sensitive/github/starred/derived/` | 否 |
| 已明确公开的单仓库双版本 Markdown | `data/curation.sqlite` 的 `open_source_items` | 是 |

同步器不再写 Supabase。完整 Star、原始 README 与模型派生内容只留在本机敏感目录；白名单内且已有阅读版的条目写入 Git 跟踪的只读公开 SQLite，同时生成 `ask_documents` 分块并重建 `data/sensitive/local-vectors.sqlite`。

详情页的“仓库结构”不是本地敏感副本：页面先从 SQLite 公开投影确认该仓库已发布，再由服务器按需读取对应的公开 GitHub 仓库树和单个文本文件；浏览器永远不会得到 GitHub Token。结果缓存 10 分钟，单文件预览上限 512 KB，二进制文件仅提供 GitHub 原文件链接。线上建议设置仅具公开仓库读取权限的 `GITHUB_TOKEN`，以避免 GitHub 匿名 API 限流。

## 执行

首次初始化会读取当前全部 GitHub Star、保留本地敏感副本，并默认使用本机 Codex CLI 解析每个仓库：

```bash
pnpm github:starred:init
```

初始化可以中断后重跑：内容 SHA 未变化的仓库会复用本地中文阅读版和一句话简介。单次模型请求默认最多等待 4 分钟；超时仓库会记录失败但不会阻塞其余批次，下次运行可以继续处理。

每日增量任务会先分页读取当前 Star 元数据；仅新出现的仓库、默认分支变化的仓库，或 GitHub `updatedAt` 变化的仓库，才会重新读取 README。它会解析这些变更仓库，并自动补偿此前未完成或失败的历史解析；已完成且未变化的仓库不会再次调用所选模型：

```bash
pnpm github:starred:daily
```

该任务必须在保存 GitHub 登录态和 Codex CLI 登录态的本机环境执行；不要放进前端或 Vercel。Codex 默认单并发，避免同时启动大量 Agent 会话；`--limit 20` 可用于小范围验证，`--only owner/repository` 可重试单个仓库，`--concurrency 2` 可显式提高并发。

## 解析引擎

默认路径使用本机已登录的 Codex CLI；Pi / Kimi 保留为显式备选。两条路径使用同一受限翻译/解析提示，最终文本都沿用相同的本地私有落盘与 SQLite 发布逻辑。

```bash
pnpm github:starred:analyze
pnpm github:starred:analyze:pi
pnpm github:starred:analyze:pi -- --only owner/repository
```

可在 `config/github-sync.json` 的 `analysis.codex_cli` 中设置 Codex 并发与超时。显式使用 Pi 时需要 `KIMI_API_KEY`，默认 15 并发；两种方式都会把待处理的公开 README/仓库结构发送给所选模型。

## 中文阅读版规则

README 存在时优先解析 README。若根目录存在仓库维护的中文 README（如 `README.zh-CN.md`、`README_CN.md`），它直接成为中文阅读版，不调用模型翻译；源 README 本身为中文时也同样直接使用。没有官方中文 README 的英文 README 才交给所选解析引擎翻译，默认使用 Codex CLI，也可显式选择 Pi / Kimi。README 缺失时读取根目录和可识别的入口/manifest 文件，生成带信息缺口说明的仓库解析。

模型翻译时只翻译自然语言说明。代码块、行内代码、命令、路径、配置键、URL、Markdown 链接、仓库/产品/模型/协议名称，以及 `Skill`、`Agent`、`README`、`MCP`、`API`、`CLI`、`SDK`、`LLM`、`RAG` 等专业术语保持原样。模型不拥有工具权限，且输入 README 只作为不可信引用。若两次翻译仍无法完整保留这些内容，当前 Markdown 片段会保留原文，避免为了翻译丢失链接、代码或格式，也不会阻塞整个仓库的解析。

每个仓库还会生成一条中文一句话简介，用于开源关注列表的“仓库名称 + 简介”展示。即使采用仓库维护的中文 README，也只将 README 直接用作阅读版；一句话简介仍由所选模型基于公开仓库资料生成。若单次模型响应为空或失败，系统会以公开的 GitHub description 生成简短兜底，保证初始化不中断；下次每日补偿仍会重新尝试所选模型。简介与中文阅读版一起保存在本地派生目录；仅白名单中公开的仓库会写入站点 SQLite 投影。

## 公开范围

`config/open-source-curation.mjs` 是已选择公开的仓库白名单和个人判读。同步程序会为所有 Star 创建本地私有记录，但只有白名单中的仓库在已有中文阅读版后才生成公开投影。网站服务器只读取 `data/curation.sqlite`；它不会回退到本地敏感目录。
