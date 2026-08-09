# 当前前端框架与布局对齐

> 基线：2026-08-09 ｜ 对应视觉规范：[DESIGN.md](../DESIGN.md)

本文件描述当前已落地的页面骨架与组件职责。新增页面或改动现有页面时，以这份结构为准；不再按旧知识库/工作台方案扩展。

## 页面骨架

```text
RootLayout
├─ OpeningLoader（一次性全屏遮罩）
└─ 路由页面
   ├─ /                         首页
   │  ├─ Profile rail（sticky）
   │  └─ Daily curation stream
   └─ /curation/[id]            详情页
      ├─ Profile rail（与首页相同）
      └─ Curation article
         ├─ Back navigation
         ├─ Metadata / title / summary / tags
         ├─ Original source and media
         ├─ Markdown analysis
         └─ Source links
```

| 区域 | 主文件 | 责任 | 不应承担的责任 |
|---|---|---|---|
| 全局壳 | `app/layout.tsx` | metadata、全局 CSS、Loading 注入 | 路由内容或业务数据 |
| 首页 | `app/page.tsx` | 左右两栏编排、策展条目入口 | 详情内容渲染 |
| 详情页 | `app/curation/[id]/page.tsx` | 条目元信息、原文、媒体、解析、来源 | 第二套个人侧栏 |
| Loading | `components/opening-loader.tsx` | 加载阶段、滚动锁定、向上揭幕 | 常规页面配色 |
| 个人简介 | `components/profile-introduction.tsx` | 双语逐字输入/删除/最终中文状态 | 静态履历数据源 |
| 技术信号场 | `components/interactive-dot-field.tsx` | 技术词词库与稀疏视觉表达 | 标签过滤或导航 |
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
| `.curation-detail__article` | 最大 `50rem`，承接右栏阅读 | 详情结构沿用首页的留白与分隔节奏 |
| `.curation-home__bio` | `width: 100%` | 简介正文撑满身份轨，不再限制 `max-width` |
| `.interactive-dot-field` | `10rem` 高点阵画布 | 默认 12 个词可见，位置不可重叠 |

`900px` 以下收为单列；`560px` 以下策展元信息转为同一行。此项目的评审重点仍是桌面版，两栏首屏优先。

## 视觉与交互对齐

| 主题 | 现状 | 约束 |
|---|---|---|
| 色彩 | 页面主体是黑白灰；绿色仅在 Loading | 禁止在内容页新增黄、绿或渐变点缀 |
| 层级 | 细线 + 留白 + 字重 | 禁止卡片网格、装饰阴影和玻璃效果 |
| 技术感 | 等宽技术节点 + 低幅运动效 | 禁止把页面正文全面等宽化 |
| 简介 | 英文输入、删除、空光标两次、中文输入并停留 | 必须保留 `prefers-reduced-motion` 的最终中文状态 |
| 流式内容 | 三列策展行，hover 只做文字/箭头轻变化 | 禁止 hover 变卡片或填充色块 |
| 深色模式 | 替换黑白灰令牌 | 不新建独立暗色品牌风格 |

## 变更准则

1. 新增页面先决定它属于“右栏内容流”还是“详情文章”；默认复用身份轨。
2. 新增组件先检查 `DESIGN.md` 的组件与禁用项；能用分隔线解决的层级，不新增卡片容器。
3. 新增动效必须具备终态、可中断清理和 reduced-motion 方案；动效不能把正文留在空白状态。
4. 调整左栏文本时同时检查可用宽度、长文本换行和词节点碰撞；不能只看单一静态截图。
5. 详情页若新增内容区，只能接在文章顺序中，并继续使用 `.curation-detail__section` / `.curation-detail__sources` 的分隔结构。

## 当前对齐结论

- 首页、详情页均已采用同一左侧身份轨，避免旧版详情页回退为独立工作台。
- 策展内容已从卡片选择器收敛为默认信息流；详情页继承同样的排版语法。
- Loading、技术信号、双语简介属于身份轨的三种不同时间尺度的动效，分别为一次性揭幕、环境信号、个人叙事；它们不应扩散到右侧内容流。
- 旧知识库、语雀同步、表格工作区及相关框架不再属于当前前端信息架构。
