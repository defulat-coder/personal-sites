---
type: Source System
title: GitHub — defulat-coder
description: 自有、Starred、Watched 仓库及其关系历史的项目资料源。
resource: https://github.com/defulat-coder
tags: [github, projects, source]
timestamp: 2026-07-18T00:00:00+08:00
visibility: public
review_status: pending
---

GitHub 提供项目名称、仓库关系、语言、更新时间和链接等可验证元数据。当前私有 Raw 清单位于 `data/private/github/raw/`，生成后的 OKF Concepts 位于 `knowledge/private/personal/github/`；两处都被 Git 忽略，不会直接进入公开网站。

2026-07-18 的完整同步覆盖 127 个自有仓库、397 个 Starred 仓库和 0 个 Watched 仓库；按 GitHub 数字仓库 ID 合并后为 521 个唯一仓库。数量属于快照数据，未来以 Raw manifest 为准。

仓库存在或属于当前账号不自动等于完全原创。OKF 自动区分账号 Fork、Starred、Watched 和 inactive 历史；18 个自有非 Fork 仓库进入人工复核队列，后续再确认 Built、Adapted、Translated 或 Learning 等项目角色。

更新入口：

```bash
npm run data:update:github
```
