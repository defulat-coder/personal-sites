# 每日动态同步与 Supabase

`modules/ai-news/` 是上游 AI 资讯聚合接口的同步模块。上游接口匿名只读、无需密钥；同步任务只把数据搬进 Supabase，网站不直接请求上游。

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| 精选 + 24 小时全部动态的原始条目 | 无（仅 ETag 状态 `var/ai-news/`） | `public.ai_news_items`（RLS 私有表） | 否 |
| 页面展示用的公开投影 | 不以本地文件为运行时来源 | `public.ai_news_public_items`（RLS 公开只读） | 是 |

公开投影只保留页面需要的字段（标题、摘要、推荐理由、分类、评分、来源名、发布时间、第三方原文链接）。没有第三方原文链接的条目不进入公开表，页面任何位置都不出现上游站点的链接或标识。

## 同步

1. 通过 `pnpm supabase:push` 应用 [迁移](../supabase/migrations/20260814130000_ai_news_storage.sql)（先 `--dry-run` 预演）。
2. 手动执行一次 `pnpm ai-news:sync`（增量）和 `pnpm ai-news:backfill`（7 天回填）验证。
3. 定时任务（首选 GitHub Actions，本机 launchd 为可选兜底）：
   - `.github/workflows/ai-news-sync.yml`：每小时跑增量（24h 窗口，错开整点），每天 20:17 UTC（北京时间 04:17）跑 7 天回填；手动触发支持 `backfill` 输入。需在仓库 Settings → Secrets and variables → Actions 配置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
   - Actions 环境无持久磁盘，ETag 条件请求状态（`var/ai-news/sync-state.json`）不跨运行保留，每次运行按全量 upsert 处理（幂等，按 id 冲突覆盖）。
   - 注意私有仓库 Actions 免费额度为每月 2000 分钟；每小时一次约消耗 720~1440 分钟/月，额度内可跑满整月。仓库 60 天无活动时 GitHub 会暂停 scheduled workflow，需到 Actions 页手动恢复。
   - 本机 launchd 兜底（plist 模板在 `config/` 下，含本机 nvm 的 Node 绝对路径，Node 大版本升级后需同步更新）：
     - `ai-news-sync.launchd.plist`：每 5 分钟跑增量（24h 窗口），日志 `var/ai-news/sync.log`；
     - `ai-news-backfill.launchd.plist`：每天 04:17 跑 7 天回填，日志 `var/ai-news/backfill.log`。

     ```bash
     cp config/ai-news-*.launchd.plist ~/Library/LaunchAgents/
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-sync.plist
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-backfill.plist
     # 卸载：launchctl bootout gui/$(id -u)/site.personal.ai-news-sync（backfill 同理）
     ```

## 行为约定

- 上游原生时间窗只有 24h 和 7d：增量同步用 24h 窗口（便宜），回填用 7d 窗口（全量分页，上限 60 页）；更早的历史上游不提供。
- 两个 feed：`mode=all`（全部动态）与 `mode=selected`（精选），按 all → selected 顺序处理，同 id 条目的 `selected` 标记以精选为准；selected feed 条件请求命中 304 时，同步会先读出当前精选 id 并在 upsert 后还原，避免被 all feed 的覆盖语义清掉。
- 增量同步带 `If-None-Match` 条件请求（ETag 存于 `var/ai-news/sync-state.json`），无变化时跳过重写；回填不读写 ETag 状态。
- 清理按内容时间：发布时间（缺失时用同步时间）超过 8 天的行从两张表删除。
- 网站服务端用 publishable key 读 `ai_news_public_items`（`lib/ai-news.ts`）：列表分页（首页 50 条 + `/api/ai-news` 滚动加载，精选条目带标记），详情按 id 直查；不会回退到上游接口或本地文件。
