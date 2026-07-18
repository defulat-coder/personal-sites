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
- `knowledge/private/personal/` 是由 Raw 数据确定性生成的完整私有 OKF Bundle；
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

## 生成与验证

```bash
npm run data:finalize:yuque
npm run data:build:okf
npm run data:verify:okf
```

生成器不会修改 Raw 数据。若 Raw 对象改变，重新生成 Bundle 即可。
