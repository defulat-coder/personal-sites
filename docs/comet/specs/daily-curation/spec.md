# 每日关注（daily-curation，来源拆分后的完整规格）

「每日关注」是站点 `/curation` 的跨时间策展判断流。来源拆分后，它只呈现公开投影 `data/curation.sqlite` 中 `source.platform = "x"` 的条目；抖音来源条目由「抖音收藏」板块（`/douyin`）承载。

## 列表

- `/curation` 首屏与「加载更多」（`/api/curation`）只返回 X 来源条目，排序保持 `collected_at DESC, collected_order ASC, published_at DESC, id DESC`
- `/api/curation` 的请求参数与响应 schema 不变；仅结果集合收窄为 X 来源
- 信息流样式、会话快照恢复、无限滚动行为维持现状，快照 key 与抖音板块互不覆盖
- X 条目为零时渲染正常空状态

## 详情页

- `/curation/[id]` 同时服务 X 与抖音条目（抖音条目 ID 形如 `douyin-<aweme_id>`），版式与媒体渲染逻辑不变
- 返回链接按条目来源分流：X 条目显示「返回每日关注」指向 `/curation`；抖音条目显示「返回抖音收藏」指向 `/douyin`
- 相邻条目导航按来源限定：X 条目的上一则/下一则只在 X 条目内取；抖音条目只在抖音条目内取

## 导航与元数据

- 版块刊头在「每日关注」之后新增「抖音收藏」入口；`/curation` 页面刊头当前项仍为「每日关注」
- 页面描述更新为如实反映纯 X 来源的判断流

## 数据边界

- 只读公开投影 `data/curation.sqlite`，ISR `revalidate = 300` 与 loading 状态保持不变
- 不访问 `data/sensitive/`；「问一问」检索语料不变
