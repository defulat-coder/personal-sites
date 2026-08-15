# personal-sites · 个人网站

一个以个人工程身份为锚点的桌面优先站点——不是静态简历，而是一份运行中的工程档案：用持续更新的策展与判断证明工程身份。

**线上地址：** https://default-coder.vercel.app/

## 站点版块

| 版块 | 路径 | 内容 |
| --- | --- | --- |
| 首页 | `/` | 身份轨 + 各版块的最新快照流 |
| 每日动态 | `/ai-news` | AI/Agent 领域动态，每 5 分钟自动同步 |
| 每日关注 | `/curation` | X（Twitter）点赞/书签的中文策展与判读 |
| 开源关注 | `/open-source` | GitHub Star 仓库的中文阅读版与个人判读 |
| 构建 | `/works` | 个人项目产出（首发为本站自身的数据管线） |
| 问一问 | `/ask` | 基于站内语料的匿名问答入口 |

## 技术栈

- **站点**：Next.js 16（App Router）+ React 19 + Tailwind CSS 4 + shadcn/ui
- **数据**：Supabase（Postgres 公开投影表 + 私有 Storage）
- **部署**：Vercel；内容同步跑在 GitHub Actions
- **内容管道**：本地策展脚本 → AI 解析（Pi Coding Agent / Kimi）→ Supabase 公开投影 → 站点以 ISR（`revalidate = 300`）读取

```
本地抓取/策展（敏感原始数据不入库、不入 Git）
      │
      ▼  AI 解析、脱敏、生成公开投影
Supabase 公开表（ai_news_public_items 等）
      │
      ▼  ISR 读取
站点页面（浏览器只见公开投影）
```

## 本地开发

```bash
pnpm install          # Node.js >= 22.19，包管理器 pnpm@11
pnpm dev              # 开发服务器（Turbopack）
pnpm typecheck        # TypeScript 7（scripts/tsc7.mjs）
pnpm lint
pnpm test             # Vitest + node:test
pnpm build
```

环境变量见 `.env.example`：站点运行只需要 `SUPABASE_URL` 与 `SUPABASE_PUBLISHABLE_KEY`（读公开表）；同步脚本额外需要 `SUPABASE_SERVICE_ROLE_KEY` 等，仅服务端使用，绝不使用 `NEXT_PUBLIC_` 前缀。

## 数据同步

- **每日动态**：`pnpm ai-news:sync`，GitHub Actions 每 5 分钟增量同步（24h 窗口）、每天 04:17（北京时间）回填 7 天，详见 `docs/ai-news-sync.md`。
- **开源关注**：`pnpm github:starred:sync`，详见 `docs/github-starred-sync.md`。
- **每日关注**：`pnpm curation:*` 系列命令，详见 `docs/supabase-x-sync.md`。

## 数据边界

本仓库公开展示系统与本地资料管道共存。原始个人资料、抓取快照、会话记录等敏感数据只存于本机（`data/sensitive/`、`knowledge/sensitive/` 等，均被 `.gitignore` 覆盖并有提交前检查），站点与 Git 仓库只接触经审查的公开投影。详见 `docs/sensitive-data.md`。

## 文档

- `PRODUCT.md` — 产品定位与设计原则
- `DESIGN.md` — 视觉与设计规则
- `docs/frontend-architecture.md` — 前端架构
- `AGENTS.md` — 协作与工程约定
