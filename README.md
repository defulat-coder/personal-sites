# personal-sites · 个人网站

一个以个人工程身份为锚点的桌面优先站点——不是静态简历，而是一份运行中的工程档案：用持续更新的策展与判断证明工程身份。

仅交付 Web 端，兼容桌面与手机浏览器；移动端沿用相同栏目、内容与问答能力。

**线上地址：** https://default-coder.lovemyrmb.cn/

## 站点版块

| 版块 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 身份轨 + 各版块的最新快照流 |
| 每日动态 | `/ai-news` | AI/Agent 领域动态，每 5 分钟自动同步 |
| 每日关注 | `/curation` | X（Twitter）点赞/书签的中文策展与判读 |
| 开源关注 | `/open-source` | GitHub Star 仓库的中文阅读版与个人判读 |
| 构建 | `/works` | 个人项目产出（首发为本站自身的数据管线） |
| 问一问 | `/ask` | 基于个人简介、项目档案、每日关注与开源关注的匿名问答入口 |

## 技术栈

- **站点**：Next.js 16（App Router）+ React 19 + Tailwind CSS 4 + shadcn/ui
- **数据**：每日动态使用 Supabase 公开投影；每日关注、开源关注、项目档案与问答索引使用随 Git 发布的只读 SQLite
- **部署**：Vercel；每日动态由 Supabase Cron 增量同步、GitHub Actions 每日回填，其余内容在本机审核发布
- **内容管道**：本地抓取 → AI 解析（Codex CLI 默认，可显式选择 Pi/Kimi）→ Git 管理的公开 SQLite → Vercel 部署只读查询

```
本地抓取/策展（敏感原始数据不入库、不入 Git）
      │
      ▼  AI 解析、脱敏、生成公开投影
X SQLite 公开投影 + Supabase 公开表（ai_news_public_items 等）
      │
      ▼  ISR 读取
站点页面（浏览器只见公开投影）
```

## 本地开发

```bash
pnpm install          # Node.js >= 22.19，包管理器 pnpm@11
pnpm dev:domain       # https://personal-site.localhost（Turbopack）
pnpm typecheck        # TypeScript 7（scripts/tsc7.mjs）
pnpm lint
pnpm test             # Vitest + node:test
pnpm test:e2e         # Playwright + Axe 浏览器回归
pnpm build
pnpm focus:status     # 汇总每日动态、策展、Ask 索引与项目档案健康度
pnpm health:production # 连续三次探测线上统一健康端点
```

环境变量见 `.env.example`：站点运行只需要 `SUPABASE_URL` 与 `SUPABASE_PUBLISHABLE_KEY`（读公开表）；同步脚本额外需要 `SUPABASE_SERVICE_ROLE_KEY` 等，仅服务端使用，绝不使用 `NEXT_PUBLIC_` 前缀。

## 数据同步

- **每日动态**：`pnpm ai-news:sync`；Supabase Cron 每 5 分钟调用受保护的 Vercel 接口做 24h 增量同步，GitHub Actions 每天 04:17（北京时间）回填 7 天并保留手动恢复入口，详见 `docs/ai-news-sync.md`。
- **开源关注**：`pnpm github:starred:sync`，详见 `docs/github-starred-sync.md`。
- **每日关注**：`pnpm curation:*` 系列命令生成 `data/curation.sqlite`，详见 `docs/supabase-x-sync.md`。

公开发现入口包括 `/sitemap.xml`、`/robots.txt`、`/feed.xml` 与全站 Open Graph 图片；RSS 聚合每日动态、每日关注、开源关注和项目档案的最近更新。

`/api/health/data` 汇总全部公开数据面的新鲜度、Ask 索引一致性与部署 Commit；GitHub Actions 每 15 分钟探测，连续三次异常才使任务失败。

## 数据边界

本仓库公开展示系统与本地资料管道共存。原始个人资料、抓取快照、会话记录等敏感数据只存于本机（`data/sensitive/`、`knowledge/sensitive/` 等，均被 `.gitignore` 覆盖并有提交前检查），站点与 Git 仓库只接触经审查的公开投影。详见 `docs/sensitive-data.md`。

## 文档

- `PRODUCT.md` — 产品定位与设计原则
- `DESIGN.md` — 视觉与设计规则
- `docs/frontend-architecture.md` — 前端架构
- `AGENTS.md` — 协作与工程约定
