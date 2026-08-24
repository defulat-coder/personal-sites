# 抖音收藏板块（douyin-section）

站点拥有一个顶级内容板块「抖音收藏」，路由 `/douyin`，把公开投影 `data/curation.sqlite` 中 `source.platform = "douyin"` 的已发布条目单独呈现为连续阅读流。

## 页面与布局

- `/douyin` 复用 `/curation` 的页面骨架：左侧 `SiteProfile` identity rail、右侧连续内容流、顶部版块刊头 `ContentSectionNavigation`，当前项为「抖音收藏」
- 信息流复用每日关注的剪报簿样张样式：每行左列登记（收录日期、`抖音 · 作者名`、附件登记词），右列判断标题、摘要、原文摘录与标签行；不引入新颜色、卡片容器或阴影
- 页面元数据：标题「抖音收藏｜陈远」，描述说明这是来自抖音收藏视频的策展判断流
- 数据通过服务端组件直读本地 `data/curation.sqlite`，路由使用 ISR `revalidate = 300` 并提供 loading 状态，缓存行为与 `/curation` 一致
- 列表按公开投影的统一排序（`collected_at DESC, collected_order ASC, published_at DESC, id DESC`）排列

## 加载更多与会话恢复

- 初始渲染输出首屏条目；滚动到底部时通过专用 API 路由分页加载更多，只返回抖音来源条目
- 无限滚动追加的条目播放入场阶梯动画（有 cleanup、稳定终态、`prefers-reduced-motion` 降级）；首屏 SSR 条目不重播
- 会话快照使用独立 key，与每日关注的快照互不覆盖；从详情页返回时恢复各自列表的分页内容与滚动位置
- 抖音条目为零时渲染正常空状态，不抛错、不显示骨架屏卡死

## 版块导航

- `SiteSection` 枚举新增 `douyin`；桌面刊头与移动端导航的版块序列为：每日动态、每日关注、抖音收藏、开源关注、构建、问一问
- `SiteProfile`、`SectionMotionLifecycle` 等相关组件识别 `douyin` 版块

## 详情页分流

- 抖音条目继续使用既有 `/curation/[id]` 详情页，不新建路由
- 详情页返回链接按条目来源分流：抖音条目显示「返回抖音收藏」指向 `/douyin`；X 条目显示「返回每日关注」指向 `/curation`
- 相邻条目导航按来源限定：抖音条目只在抖音条目间翻页，X 条目只在 X 条目间翻页

## 数据边界

- 只读公开投影 `data/curation.sqlite`；任何运行时代码不访问 `data/sensitive/`
- 不向 Supabase 新增读取；不改动发布管道脚本
- 「问一问」检索语料（`daily_ask_documents`）保持不变，已发布抖音条目继续可被检索
