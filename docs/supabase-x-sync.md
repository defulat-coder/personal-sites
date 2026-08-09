# X 同步与 Supabase

`modules/x-sync/` 是 X 数据同步的独立模块，包含抓取/导入后的编排、公开投影和 Supabase 写入。它不替代本地备份：本机仍保留原始抓取文件、策展队列和生成后的 JSON，全部位于被 Git 忽略的 `data/sensitive/x-curation/`。

同步后的职责如下：

| 数据 | 本地 | Supabase | 网站读取 |
| --- | --- | --- | --- |
| 原始 X 抓取与完整队列 | 敏感备份 | `public.x_sync_items`（RLS 私有表） | 否 |
| Pi/Kimi 生成结果 | 敏感备份 | 私有记录的 `generated_payload` | 否 |
| 已完成解析的公开策展内容 | `generated/curation.json` 备份 | `public.x_curation_items` | 是 |

## 配置

在被 Git 忽略的 `.env.local` 中配置：

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` 只能由 `modules/x-sync/` 通过 `scripts/x-curation-publish-supabase.mjs` 使用，绝不能放入 `NEXT_PUBLIC_*` 环境变量，也不能给浏览器。`public.x_sync_items` 虽处于 Data API schema，但它启用 RLS、撤销了 anon/authenticated 的全部权限，且没有任何读取策略；因此仅 service role 可访问。

## 初始化与同步

1. 将 [迁移](../supabase/migrations/20260809032951_create_x_sync_storage.sql) 应用到已链接的 Supabase 项目。
2. 执行 `pnpm curation:publish`，将本地队列 upsert 到 Supabase。
3. 日常执行 `pnpm curation:sync`：抓取、Pi 解析、本地生成备份、Supabase 同步。

前端只在服务端从 `public.x_curation_items` 读取，缺少 Supabase 读取配置时会明确报错，不会回退到本地 JSON。`public.x_sync_items` 与 `public.x_curation_items` 都开启 RLS：前者没有 anon/authenticated 权限或策略，仅 service role 可写；后者仅允许公开只读。
