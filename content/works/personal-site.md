---
title: 这个站点本身
period: 2025 — 至今
status: 持续维护
role: 独立设计与开发
summary: 你正在浏览的这个站，是我最完整的一件在役作品：三条数据管线每日流入，AI 负责策展与判读，公开投影与隐私数据严格隔离，问一问可以直接检索站内的一切。
stack: Next.js, React, TypeScript, Tailwind CSS, Supabase, Kimi, PGroonga, Vercel
order: 1
---

## 为什么建这个站

大多数个人站是一张静态简历：写完那一刻最完整，之后每天都在过时。我想验证另一个假设——**个人身份可以有持续更新的证据**。我读了什么、关注了什么、如何判断、在构建什么，都应该以可回溯的方式沉淀在同一个地方，而且这个沉淀过程本身应该是自动化的、经得起长期运转的。

所以这个站从一开始就按「档案系统」而不是「作品集页面」来设计：内容不靠手动更新，靠管线流入。

## 数据如何流动

```text
X 点赞 / 书签
  └─ bird CLI 抓取 ── Kimi 生成中文标题 / 摘要 / 标签 / 深度解析
GitHub Star
  └─ 增量同步 ── Kimi 生成中文阅读版 / 一句话简介
AI 资讯上游
  └─ ETag 条件请求增量同步（无 AI 加工，只投影字段）
        │
        ▼
Supabase 私有原始表（RLS，仅 service role 可写）
        │
        ▼
公开只读投影（x_curation_items · github_open_source_items · ai_news_public_items）
        │
        ├── 页面：ISR revalidate 300s，数据层 unstable_cache 240s
        └── 问一问：PGroonga 全文索引 → Kimi 仅依据检索资料包回答（SSE 流式输出）
```

## 三条输入管线

### 推特点赞：从点赞到策展

我在 X 上的点赞和书签由 bird CLI 携带本机凭据抓取，交给 Kimi 生成中文标题、一句话摘要、分类标签和一篇深度解析——点赞是动作，策展是判断。原始队列写入私有表，只有通过审核的条目才发布到公开投影。管线在本机运行，因为凭据不应该离开这台机器。

### 开源关注：从 Star 到判读

GitHub Star 列表每日增量同步：只有新仓库、默认分支变化或远端更新的仓库才重新读取 README。自带中文 README 的仓库直接采用，英文 README 由 Kimi 翻译为中文阅读版（只译自然语言，代码、链接、术语保留），另生成一条中文一句话简介。三层存储里，只有白名单内且有中文阅读版的仓库才进入公开投影——Star 是兴趣，判读是立场。

### 每日动态：诚实的搬运

AI 资讯来自一个匿名只读的上游聚合接口，ETag 条件请求做 24 小时增量，每日回填 7 天窗口，超过 8 天的条目自动清理。这条管线刻意不调用任何模型：标题、摘要、推荐理由全部来自上游，页面上看到的就是来源本身。GitHub Actions 每小时跑一次，本机 launchd 每 5 分钟兜底。

## 问一问：站内的一切都可以被追问

问一问不是接了一个通用聊天框。站内三张公开投影经索引构建进 `ask_search_documents` 表，用 PostgreSQL 的 PGroonga 扩展做全文检索——是关键词检索，不是向量检索，因为我希望每条回答都能指回具体的站内条目。检索结果取前 6 条组成资料包，Kimi 被禁止调用任何工具和网络，只能依据当轮资料包回答，并用来源编号标注出处。回答经 SSE 流式返回，IP 维度限流 10 分钟 50 次，会话以 HMAC 匿名标识、保留 24 小时。

## 隐私边界

原始数据只存在于两个地方：本机被 Git 忽略的 `data/sensitive/`，和 Supabase 启用了 RLS、无任何读取策略的私有表。站点服务端只用 publishable key 读三张公开投影，且**明确不回退**到本地敏感文件或上游接口——宁可报错，不降级。service-role key 只出现在同步脚本和问一问服务端，永远不会进入 `NEXT_PUBLIC_*` 变量。

## 渲染与缓存

首页和三个详情路由都是 ISR（revalidate 300 秒），数据层再叠一层 `unstable_cache`（240 秒）；列表 API 用 `s-maxage` + `stale-while-revalidate`，并把分页参数收敛到固定档位，防止缓存键爆炸。访客看到的永远是可缓存的公开页面，动态性只留给问一问。

## 设计即工程

设计系统和数据管线是同一种工程观的两个表达。单色黑白灰，绿色只属于加载动画；层级只用细线、留白和字重，不用卡片和阴影；所有动效可中断、有稳定终态、有 `prefers-reduced-motion` 静态路径。全站只有一套 Markdown 排版，新增内容场景不允许另建样式——约束本身就是设计。

## 技术栈

Next.js 16 · React 19 · TypeScript（类型检查走 TypeScript 7 原生编译器）· Tailwind CSS 4 + 手写设计令牌 · Supabase（Postgres + RLS + PGroonga + Storage）· Kimi（经 pi-coding-agent 调用）· Zod · react-markdown · 系统字体栈，无 Web Font · 部署在 Vercel，数据管线分布在 GitHub Actions 与本机 launchd。
