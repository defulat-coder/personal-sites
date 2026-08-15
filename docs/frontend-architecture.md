# 当前前端框架与布局对齐

> 基线：2026-08-09 ｜ 对应视觉规范：[DESIGN.md](../DESIGN.md)

本文件描述当前已落地的页面骨架与组件职责。新增页面或改动现有页面时，以这份结构为准；不再按旧知识库/工作台方案扩展。

## 页面骨架

```text
RootLayout
├─ OpeningLoader（全屏遮罩，每次完整页面加载都会播放）
└─ 路由页面
   ├─ /                         首页（ISR，revalidate = 300）
   │  ├─ Profile rail（sticky）
   │  └─ 今日快照；遗留 ?view= 仅作旧链接兼容，由客户端 HomeView 读取
   ├─ /ai-news                  每日动态版块（ISR，revalidate = 300）
   ├─ /curation                 推特点赞版块（ISR，revalidate = 300）
   ├─ /open-source              开源关注版块（ISR，revalidate = 300）
   ├─ /ask                      问一问
   │  ├─ Profile rail（与首页相同）
   │  └─ 内容导航 + 公开资料问答（指纹与 Markdown 渲染按需加载）
   ├─ /curation/[id]            详情页（ISR，revalidate = 300）
   │  ├─ Profile rail（与首页相同）
   │  └─ Curation article
   │     ├─ Back navigation
   │     ├─ Metadata / title / summary / tags
   │     ├─ Original source and media
   │     ├─ Markdown analysis
   │     └─ Source links
   └─ /open-source/[slug]       开源详情页（ISR，revalidate = 300）
      ├─ Profile rail（与首页相同）
      └─ 文档版本切换为客户端状态，中文阅读版服务端渲染
```

| 区域 | 主文件 | 责任 | 不应承担的责任 |
|---|---|---|---|
| 全局壳 | `app/layout.tsx` | metadata、全局 CSS、Loading 注入 | 路由内容或业务数据 |
| 首页 | `app/page.tsx` | ISR 静态壳 + `HomeView`/`HomeMain` 编排、策展条目入口 | 详情内容渲染；遗留 `?view=` 不进服务端 |
| 版块页 | `app/ai-news/page.tsx`、`app/curation/page.tsx`、`app/open-source/page.tsx` | 单版块的 ISR 列表页，复用身份轨与刊头 | 第二套侧栏语言 |
| 详情页 | `app/curation/[id]/page.tsx` | 条目元信息、原文、媒体、解析、来源 | 第二套个人侧栏 |
| Loading | `components/opening-loader.tsx` | 加载阶段、滚动锁定、向上揭幕；每次完整页面加载都播放，水合后移除 | 常规页面配色 |
| 个人简介 | `components/profile-introduction.tsx` | 双语逐字输入/删除、最终中文正文与多语言标题轮换；每次进入首页都播放 | 静态履历数据源 |
| 内容导航 | `components/site-section-navigation.tsx` | 统一内容入口（每日动态、推特点赞、开源关注、问一问）的路由跳转与当前页面状态；导航即栏目页头，不重复显示标题与说明 | 外部链接或同页 Tab 语义 |
| 技术信号场 | `components/interactive-dot-field.tsx` | AI 术语与技术栈词库、稀疏视觉表达 | 标签过滤或导航 |
| 策展数据 | `lib/curation.ts` | Zod 校验、查询、日期格式化 | 页面布局 |

## 桌面布局契约

```text
┌──────────────────── identity rail ────────────────────┬──────── content flow ────────┐
│ avatar · name · GitHub · technical signal · profile    │ curation list / article       │
│ sticky, 100dvh, 30px padding                            │ continuously divided rows      │
└────────────────────────────────────────────────────────┴─────────────────────────────┘
```

| 选择器 | 当前规则 | 对齐要求 |
|---|---|---|
| `.curation-home` | 两栏 Grid；左栏最小 `28rem`、最大 `38vw` | 新首页内容不得破坏此列关系 |
| `.curation-home__profile` | `sticky`、`100dvh`、`1.875rem` padding | 首页与详情页必须视觉一致 |
| `.curation-home__feed` | 最大 `50rem`，右侧连续流 | 使用行与行分隔，不包卡片 |
| `ContentSectionNavigation` | 每日动态、推特点赞、开源关注、问一问共享等权内容入口；导航即栏目页头 | 使用站内链接与 `aria-current`，不得伪装为同页 Tab |
| `.curation-detail__article` | 最大 `50rem`，承接右栏阅读 | 详情结构沿用首页的留白与分隔节奏 |
| `.curation-home__bio` | `width: 100%` | 简介正文撑满身份轨，不再限制 `max-width` |
| `.interactive-dot-field` | `11.5rem` 高点阵画布 | AI 术语 12 词 + 技术栈 26 词按 6 条泳道滚动，泳道参数由组件按索引确定性内联，同泳道等相位差不重叠 |

`900px` 以下收为单列；`560px` 以下策展元信息转为同一行。此项目的评审重点仍是桌面版，两栏首屏优先。

## 视觉与交互对齐

| 主题 | 现状 | 约束 |
|---|---|---|
| 色彩 | 页面主体是黑白灰；绿色仅在 Loading | 禁止在内容页新增黄、绿或渐变点缀 |
| 层级 | 细线 + 留白 + 字重 | 禁止卡片网格、装饰阴影和玻璃效果 |
| 技术感 | 等宽技术节点 + 低幅运动效 | 禁止把页面正文全面等宽化 |
| 简介 | 英文输入、删除、空光标两次、中文输入；完成后标题轮换多语言问候语 | `prefers-reduced-motion` 下保留最终中文状态，不进入轮换 |
| 流式内容 | 三列策展行，hover 只做文字/箭头轻变化 | 禁止 hover 变卡片或填充色块 |
| 深色模式 | 替换黑白灰令牌 | 不新建独立暗色品牌风格 |

## 变更准则

1. 新增页面先决定它属于“右栏内容流”还是“详情文章”；默认复用身份轨。
2. 新增组件先检查 `DESIGN.md` 的组件与禁用项；能用分隔线解决的层级，不新增卡片容器。
3. 新增动效必须具备终态、可中断清理和 reduced-motion 方案；动效不能把正文留在空白状态。
4. 调整左栏文本时同时检查可用宽度、长文本换行和词节点碰撞；不能只看单一静态截图。
5. 详情页若新增内容区，只能接在文章顺序中，并继续使用 `.curation-detail__section` / `.curation-detail__sources` 的分隔结构。

## 当前对齐结论

- 首页、问一问、详情页均采用同一左侧身份轨，避免旧版详情页回退为独立工作台。
- 桌面左侧个人资料是首页锚点，右侧默认显示每日动态；移动端把个人资料展开为默认首页，导航置于身份区与内容区之间，并在内容页随紧凑身份区固定。移动端内容 Grid 必须从顶部自然排布，避免少量内容拉伸身份区与内容区之间的间距。每日动态、推特点赞、开源关注、问一问不再重复显示栏目标题或摘要。
- 动效分工保持克制：Loading、技术信号场和双语简介分别承担揭幕、环境与叙事；栏目导航只负责解释状态变化。移动端首页与内容页之间使用短促的前进/返回内容过渡，桌面同级栏目与开源主题筛选使用轻量淡入换页；所有栏目动效必须在 `prefers-reduced-motion` 下即时完成。
- 移动端首页进入内容页时，身份轨不直接动画整体高度：信号场和简介先离场，头像与身份信息通过临时共享覆盖层收拢到紧凑头部，导航与内容流随后落位；从内容页回首页按相反节奏展开。该覆盖层必须 `aria-hidden`、不可交互并在终态后清理。
- 策展内容已从卡片选择器收敛为默认信息流；详情页继承同样的排版语法。
- 开源关注的主题筛选采用带项目数的轻量文本索引：当前项只用短下划线强调，小屏自动换行，不使用按钮块或横向滚动。
- Loading、技术信号、双语简介属于身份轨的三种不同时间尺度的动效，分别为每会话一次的揭幕、环境信号、个人叙事；它们不应扩散到右侧内容流。
- 旧知识库、语雀同步、表格工作区及相关框架不再属于当前前端信息架构。
