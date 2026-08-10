# 建立公开资料全文检索数据层

- Type: database and retrieval contract
- Status: ready
- Blocked by: none

## Outcome

Supabase 能安全地为已发布每日关注与公开 README 片段提供中文全文召回，且浏览器不能绕过问答 API 直接查询检索表或 RPC。

## Scope

- 通过正式迁移启用并验证 PGroonga；迁移执行前遵循项目的 Supabase dry-run 约束。
- 建立仅承载公开投影的检索文档存储，包含稳定文档标识、资料范围、来源标题/章节、可回链地址、公开正文与发布版本信息。
- 为中文全文查询建立 PGroonga 索引和服务端搜索函数：支持 `all`、`daily`、`open-source` 三个范围，返回受限数量的排序结果与安全可显示的匹配摘要。
- 设置 RLS、表访问与函数执行权限：匿名浏览器不能读取检索表或调用搜索函数；服务端问答路径可以使用受控凭据调用。
- 为中文、英文项目名、精确技术词、范围过滤、空结果和撤回后的不可检索性建立数据库级验证。

## Acceptance

- 真实数据库可创建扩展、表、索引与搜索函数，且 `EXPLAIN`/查询证明 PGroonga 在目标数据量上的可用性。
- 中文查询可召回预期公开资料；结果包含稳定来源定位信息，不含敏感字段或原始同步记录。
- 使用 publishable key 的匿名访问被拒绝；服务端路径可获得相同结果。
- 迁移和测试不读取、复制或暴露 `data/sensitive/`、`knowledge/sensitive/` 或本地凭据。

## Notes

全文检索是首版唯一召回机制；不得顺带加入 pgvector、Embedding 字段或混合排序。
