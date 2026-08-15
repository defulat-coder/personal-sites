---
version: 1
slug: "app-curation-page-tsx"
primary_target: "app/curation/page.tsx"
related_targets: ["app/curation/[id]/page.tsx","app/curation/[id]/loading.tsx","components/curation-stream.tsx","lib/curation.ts","lib/curation-types.ts","lib/curation-format.ts"]
---

# Surface: 推特点赞（/curation 列表 + /curation/[id] 详情）

- Scope: 推特点赞判断流的两个路由；组件 CurationStream 同时服务首页遗留 ?view=daily。
- Mode: Read——访客通过"他赞了什么 + 他怎么判断"评估其工程判断力。
- Audience/job: 同行工程师与潜在合作方，快速扫读判断质量；陈远自己的日常回读入口。
- Proof/content: 判断题名 + 策展解析（主角）、原推剪报摘录（证据）、附件登记词、标签行；详情页为 sticky 样张贴片 + 深度解析对页。
- Direction: 剪报簿（概念种子 8999beeb，dealt #3；auto 模式代用户锁定）。列表 = 判断 + 证据同行登记；详情 = 摊开对页（`curation-detail--spread`）：左页 sticky 原推样张（top:2rem、列内滚动），右页解析，取消 eyebrow 窄列；页底相邻剪报导航。
- Memorable moment: 列表行内 1px 左引线的原推摘录与解析同屏对照；详情页滚动解析时左页剪报始终钉在视线内。
- Constraints: 单色黑白灰、1px 细线、无徽章无箭头无卡片；深色只换令牌（样张正文深色 #d4d4d6 降调；深色 hover 降调 #b8b8bb 是全站约定）；works/open-source 详情仍用旧两列骨架，`--spread` 是隔离边界。
- Data: 列表投影含 text/tags/attachments（lib/curation.ts v3 缓存键）；相邻条目由 getCurationNeighbors 按列表同一排序定位。
- Open: 标签只展示不可筛选；附件登记词不链到媒体。
