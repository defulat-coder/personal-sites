# 每日动态同步与 Supabase

`modules/ai-news/` 是上游 AI 资讯聚合接口的同步模块。上游接口匿名只读、无需密钥；同步任务只把数据搬进 Supabase，网站不直接请求上游。

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| 精选 + 24 小时全部动态的原始条目 | 无 | `public.ai_news_items`（RLS 私有表） | 否 |
| 页面展示用的公开投影 | 不以本地文件为运行时来源 | `public.ai_news_public_items`（RLS 公开只读） | 是 |
| 同步 ETag、租约与健康状态 | 无 | `public.ai_news_sync_state`（仅 service role） | 否 |

公开投影只保留页面需要的字段（标题、摘要、推荐理由、分类、评分、来源名、发布时间、第三方原文链接）。没有第三方原文链接的条目不进入公开表，页面任何位置都不出现上游站点的链接或标识。

## 同步

1. 通过 `pnpm supabase:push` 应用 [迁移](../supabase/migrations/20260814130000_ai_news_storage.sql)（先 `--dry-run` 预演）。
2. 手动执行一次 `pnpm ai-news:sync`（增量）和 `pnpm ai-news:backfill`（7 天回填）验证。
3. 定时任务：
   - Supabase Cron 每 5 分钟通过 `pg_net` 调用 `POST /api/cron/ai-news`，执行 24h 增量同步。Bearer 密钥由迁移随机生成，明文只保存在 Supabase Vault；Vercel 接口读取私有状态表中的 SHA-256 摘要校验请求。
   - `.github/workflows/ai-news-sync.yml`：每天 20:17 UTC（北京时间 04:17）跑 7 天回填，并保留 `workflow_dispatch` 手动增量/回填入口。需在仓库 Actions Secrets 配置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`。
   - `/api/health/ai-news` 返回最近成功时间和同步年龄；超过 20 分钟没有成功同步时返回 503，可接入外部 uptime 监控。
   - 站点侧不做时间缓存：首页与每日动态页面动态渲染、每请求直读公开投影，同步落库后下一次访问即为最新。
   - ETag、4 分钟租约、最后成功/失败和统计统一保存在 `ai_news_sync_state`；Supabase Cron、GitHub Actions、手动 CLI 和本机 launchd 共享同一租约，重复触发会安全跳过。
   - 本机 launchd 只作为故障恢复手段（plist 模板在 `config/` 下，仓库内不含本机路径，安装前需替换占位符）：
     - `ai-news-sync.launchd.plist`：每 5 分钟跑增量（24h 窗口），日志 `var/ai-news/sync.log`；
     - `ai-news-backfill.launchd.plist`：每天 04:17 跑 7 天回填，日志 `var/ai-news/backfill.log`。

     ```bash
     # 先替换占位符：__NODE_BIN__ 为本机 node 所在目录（nvm 路径含版本号，Node 大版本升级后需更新），
     # __REPO_ROOT__ 为仓库绝对路径
     for f in config/ai-news-*.launchd.plist; do
       sed -e "s|__NODE_BIN__|$(dirname "$(command -v node)")|g" \
           -e "s|__REPO_ROOT__|$PWD|g" "$f" > ~/Library/LaunchAgents/"$(basename "$f")"
     done
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-sync.plist
     launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/site.personal.ai-news-backfill.plist
     # 卸载：launchctl bootout gui/$(id -u)/site.personal.ai-news-sync（backfill 同理）
     ```

## 行为约定

- 上游原生时间窗只有 24h 和 7d：增量同步用 24h 窗口（便宜），回填用 7d 窗口（全量分页，上限 60 页）；更早的历史上游不提供。
- 两个 feed：`mode=all`（全部动态）与 `mode=selected`（精选），按 all → selected 顺序处理，同 id 条目的 `selected` 标记以精选为准；selected feed 条件请求命中 304 时，同步会先读出当前精选 id 并在 upsert 后还原，避免被 all feed 的覆盖语义清掉。
- 增量同步带 `If-None-Match` 条件请求（ETag 存于私有状态表），无变化时跳过重写；回填不改写增量 ETag。
- 清理按内容时间：发布时间（缺失时用同步时间）超过 8 天的行从两张表删除。
- 网站服务端用 publishable key 读 `ai_news_public_items`（`lib/ai-news.ts`）：列表分页（首页 50 条 + `/api/ai-news` 滚动加载，精选条目带标记），详情按 id 直查；不会回退到上游接口或本地文件。
