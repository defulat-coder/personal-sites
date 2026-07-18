---
type: Documentation
title: Open Knowledge Format 数据层说明
description: 本项目采用 OKF v0.1 的范围、隐私边界和生成流程。
tags: [okf, documentation]
timestamp: 2026-07-18T00:00:00+08:00
visibility: public
review_status: approved
---

# Open Knowledge Format 数据层

本项目的数据知识层采用 Google Cloud 发布的 **Open Knowledge Format (OKF) v0.1 Draft**。

权威来源：

- [OKF v0.1 Specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [Google Cloud announcement](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)

OKF 是知识表示格式，不是原始数据备份格式。两者的边界是：

- `data/private/yuque/raw/` 保存语雀 API 原始对象、正文格式、附件和校验清单；
- `data/private/github/raw/` 保存 GitHub 仓库清单、关系历史、README 证据和增量快照；
- `knowledge/private/personal/` 是由语雀与 GitHub Raw 数据确定性生成的完整私有 OKF Bundle；
- `knowledge/public/` 只接收人工确认、完成脱敏、允许进入个人网站的 OKF Concepts。

完整私有 Bundle 默认不进 Git，避免私有语雀内容进入未来的公开网站仓库。

## OKF v0.1 在本项目中的落实

- 每个 Concept 是 UTF-8 Markdown 文件；
- 每个非保留 Markdown 文件都有 YAML frontmatter，且必须含非空 `type`；
- 文件相对路径就是 Concept ID；
- `index.md` 用于渐进披露，`log.md` 用于变更记录；
- 概念之间使用普通 Markdown 链接；
- `source_object`、`source_sha256`、`visibility`、`review_status` 等是生产者扩展字段，符合 OKF 对未知字段的开放约定；
- 网站只消费 `review_status: approved` 且 `visibility: public` 的 Concepts。

## 私有知识整理策略

整理发生在 `knowledge/private/personal/` 派生层，不改写 `data/private/yuque/raw/`：

- 概念路径由语雀来源类型、知识库 ID 和对象 ID 决定，重新生成后保持稳定；
- 精确重复正文只在一个主概念中保留，其他来源生成带回链的引用桩；
- 近似重复只进入 `yuque/review/` 人工复核队列，不自动合并；
- 同标题但正文不同的概念建立互链并进入复核，不把“同名”误当成“重复”；
- 空正文、无有效文本、纯媒体、短小记和源端已删除内容分别标记，不因内容短或格式特殊而直接删除；
- `yuque/curation-report.md` 提供可读摘要，Bundle 根目录的 `curation.json` 保存逐条决定和去重证据；
- `content_quality`、`curation_status`、`content_fingerprint`、`duplicate_of` 和 `near_duplicates` 是本项目的 OKF 生产者扩展字段。

## GitHub 项目整理策略

- Concept 路径使用不可变的 GitHub 数字仓库 ID：`github/repositories/<id>.md`，仓库改名或转移不会改变 Concept ID；
- Owned、Starred、Watched 只是同一仓库的关系，同一数字 ID 在 Bundle 中只生成一份 Concept；
- 自有非 Fork、账号 Fork、Starred、Watched、Archived、Inactive 和语言分组分别提供渐进式 `index.md`；
- 自有非 Fork 不自动等于完全原创，必须人工确认 Built、Adapted、Translated、Learning 等项目角色；
- Star 或 Watch 只表示关注、参考或订阅，不推断作者身份；
- 后续同步保留 `first_seen_at`、`last_changed_at`、关系增加/移除、inactive 和 reactivated 历史；
- 合格的自有非 Fork 仓库 README 作为证据快照进入私有 Concept，Raw 哈希与来源路径保留在 frontmatter；
- `github/curation-report.md` 提供可读摘要，Bundle 根目录的 `github-curation.json` 保存逐仓库整理结果。

## 生成与验证

```bash
npm run data:finalize:yuque
npm run data:sync:github
npm run data:verify:github
npm run data:build:okf
npm run data:verify:okf
```

`data:update:github` 会依次同步 GitHub、校验 Raw、重建统一 Bundle 并校验 OKF。`data:verify:okf` 会同时验证通用 OKF 结构、语雀整理报告、重复引用、近似内容双向链接，以及 GitHub 稳定 ID、关系索引和 Raw 追溯的一致性。生成器不会修改 Raw 数据；若任一 Raw 对象改变，重新生成 Bundle 即可。
