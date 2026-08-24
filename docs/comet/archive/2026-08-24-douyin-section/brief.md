# Outcome

公开站点新增独立板块「抖音收藏」（路由 `/douyin`），把已发布到公开投影 `data/curation.sqlite` 的抖音来源条目从「每日关注」混合流中拆出单独呈现；「每日关注」随之变为纯 X 来源的判断流。访客可以从版块导航进入「抖音收藏」，浏览抖音条目信息流，并进入既有详情页阅读完整解析。

# Scope

- 新建 `/douyin` 页面：沿用 `/curation` 的页面骨架（`SiteProfile`、版块刊头、`revalidate = 300`、本地 sqlite 读取），信息流复用剪报簿样张样式
- 新增按来源过滤的数据查询：抖音板块只读 `source.platform = "douyin"` 的条目；`/curation` 列表与其加载更多接口只返回 X 来源条目
- 版块导航（桌面刊头 `ContentSectionNavigation` 与移动端 `MobileSectionNavigation`/`SiteProfile`）新增「抖音收藏」，位于「每日关注」之后
- 详情页 `/curation/[id]` 的返回链接与相邻条目导航按条目来源分流：抖音条目返回 `/douyin`、相邻条目只取抖音；X 条目维持返回 `/curation`、相邻条目只取 X
- 抖音列表的「加载更多」使用独立 API 通道与独立会话快照 key，不与每日关注的快照互相覆盖

# Non-goals

- 不改动 iOS / Android 客户端（不动 `lib/*-types.ts` 的导出类型与现有 `/api` 响应 schema）
- 不处理 864 条私有待审队列（`data/sensitive/douyin-curation/`）；审核与同步是数据运营，不属于本 change
- 不改「问一问」检索语料：已发布抖音条目继续保留在 `daily_ask_documents` 并可被检索
- 不新建抖音专属详情页：抖音条目继续使用 `/curation/[id]` 详情页
- 不引入 Supabase 依赖：抖音板块与 `/curation` 一样只读本地 `data/curation.sqlite` 投影
- 不改发布/审核管道脚本（`douyin:curation`、`douyin:sync`、`curation:publish` 等）

# Acceptance examples

- A1：访问 `/douyin`，首屏列出当前全部已发布抖音条目；每行显示收录日期、`抖音 · 作者名`、判断标题、摘要、原文摘录与标签，版式与每日关注剪报样张一致
- A2：`/douyin` 列表与加载更多结果中不存在任何 X 来源条目；`/curation` 列表与 `/api/curation` 结果中不存在任何抖音来源条目
- A3：从 `/douyin` 点击条目进入 `/curation/douyin-<id>` 详情页，返回链接文案为「返回抖音收藏」并指向 `/douyin`；X 条目详情仍显示「返回每日关注」并指向 `/curation`
- A4：详情页相邻条目导航按来源限定：抖音条目的上一则/下一则只指向抖音条目，X 条目只指向 X 条目
- A5：桌面刊头与移动端导航均出现「抖音收藏」且位于「每日关注」之后；`/douyin` 页面刊头当前项显示「抖音收藏」
- A6：`/douyin` 无限滚动只追加抖音条目；从详情页返回 `/douyin` 或 `/curation` 时各自恢复自己的列表分页与滚动位置，互不覆盖
- A7：当公开投影中抖音条目为零时，`/douyin` 渲染正常空状态而非报错
- A8：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 全部通过；`/douyin` 路由分类与缓存行为（ISR `revalidate = 300`）与 `/curation` 一致

# Constraints and invariants

- 遵守 `DESIGN.md` 与 `docs/frontend-architecture.md`：全站单色黑白灰与 1px 细线登记栏，不引入卡片网格、玻璃、重阴影或新增强调色；保留桌面 identity rail + 连续内容流布局
- 只读 `data/curation.sqlite` 公开投影；任何代码路径不得读取 `data/sensitive/` 下的私有数据
- 公共策展读取保持可缓存：ISR `revalidate = 300` 并保留 loading 状态
- 新动效必须有 cleanup、稳定终态与 `prefers-reduced-motion` 降级路径
- `/api/curation` 响应 schema 不变（仅来源内容收窄为 X），客户端无需更新；抖音加载更多使用独立路由
- 项目不使用 Agent subagent 工具（环境约束），Verifier 以独立评审上下文完成只读验收

# Decisions

- Q1（工作区）：使用当前目录（`current` 隔离），不创建分支或 worktree。当前目录未提交内容为 Comet 安装等无关改动，提交时按路径拆分
- Q2（需求含义）：「集成」指在公开站点为已发布抖音条目建独立板块，而非本地审核台、执行同步管道或混入现有流
- Q3（与每日关注的关系）：抖音条目只出现在「抖音收藏」板块；「每日关注」变为纯 X 来源
- Q4（命名与位置）：板块标签「抖音收藏」，路由 `/douyin`，导航位于「每日关注」之后
- Q5（交付范围）：仅 Web 站点；iOS/Android 不在本 change 范围
- 派生决定（随 Q3 拆分的自然结果，列入确认摘要）：详情页返回链接与相邻条目导航按来源分流；`/douyin` 沿用本地 sqlite + ISR 300 模式；问一问语料不变

# Open questions

（无未解决问题；目标、范围、关键决定与验收项已于 2026-08-24 经用户明确确认）

# Verification expectations

- 类型检查、ESLint、Vitest/node 测试、生产构建全部通过
- 本地运行时用浏览器实际访问 `/douyin`、`/curation`、两类条目的详情页，核对来源过滤、返回链接、相邻导航、导航项与加载更多行为
- 核对生产构建中 `/douyin` 的路由分类与缓存行为
