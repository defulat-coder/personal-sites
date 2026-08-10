# 将公开发布流程接入检索索引

- Type: data publication integration
- Status: ready
- Blocked by: 01-public-search-schema

## Outcome

公开页面所见资料与可被问答检索的资料始终来自同一次发布结果；未发布或被撤回的内容不会残留在索引中。

## Scope

- 为每日关注公开投影构造一个检索文档，不将原始抓取、私有队列或 Pi 生成备份带入索引。
- 为公开开源资料从 `parsedMarkdown` 按 Markdown 标题生成稳定 README 片段，并保留仓库与章节级来源定位。
- 在 `modules/x-sync/publish-to-supabase.mjs` 与 `modules/github-starred/publish-to-supabase.mjs` 的公开发布路径中，同步 upsert 与撤回对应检索文档。
- 把转换与对账逻辑做成可单测的纯模块；同一输入应产生稳定文档 ID、文本和来源地址。
- 保持现有私有表写入、公开投影和展示数据契约不变。

## Acceptance

- 发布新增、更新、撤回每日关注后，全文搜索结果同步新增、变更、消失。
- 发布新增、更新、撤回开源仓库后，相关 README 片段同步对账，无孤儿文档或跨仓串位。
- 标题级切分不会丢失标题、代码术语或来源链接；整份 README 不作为单一检索结果。
- 单元测试证明只消费公开投影字段，静态检查确认没有敏感目录运行时依赖。

## Notes

索引构建不得移到访客请求或独立的滞后定时任务中。
