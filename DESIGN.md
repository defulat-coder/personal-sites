---
name: 陈远｜每日策展
description: 面向 Agent 工程实践的个人身份轨与每日策展信息流。
colors:
  ink: "#1c1c1e"
  surface: "#ffffff"
  muted: "#8f8f93"
  quiet: "#a1a1a4"
  line: "#eeeeee"
  dark-surface: "#181818"
  dark-ink: "#f4f4f4"
  loader-green: "#24cb71"
typography:
  display:
    fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "clamp(2.05rem, 4.2vw, 3.85rem)"
    fontWeight: 610
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  title:
    fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "0.95rem"
    fontWeight: 620
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  body:
    fontFamily: '"SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "0.82rem"
    lineHeight: 1.38
  signal:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.62rem"
    fontWeight: 650
rounded:
  avatar: "12px"
  media: "12px"
  pill: "999px"
spacing:
  compact: "8px"
  control: "12px"
  rail: "30px"
  section: "32px"
  stream-row: "26px"
components:
  external-link:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "9px 13px"
  stream-row:
    textColor: "{colors.ink}"
    padding: "26px 0"
  tag:
    textColor: "#6f6f72"
    rounded: "{rounded.pill}"
    padding: "7px 10px"
---

# Design System: 陈远｜每日策展

## Overview

**Creative North Star: “运行中的工程档案”。** 这是一个以个人工程身份为锚点、以每日判断为主内容的桌面优先站点。页面不把内容包进卡片，也不使用营销式 hero；身份信息作为始终可见的左侧轨道，策展和文章作为右侧连续阅读流。

视觉参考来自 Ample Studio 的克制、轻量和留白节奏，但内容与交互服务于 Agent 工程实践：信号场传达技术广度，逐字叙事传达个人履历，策展流传达持续输入与判断。

- 高对比黑白灰为主体；绿色只属于 Loading 动画，不进入常规页面。
- 平面、细分割线、连续流；不要用卡片堆叠制造层级。
- 桌面两栏是主布局；窄屏才收敛为单栏。

## Colors

### Primary

- **Ink** (`#1c1c1e`)：标题、链接、按钮和主要内容。默认内容不引入额外品牌色。
- **Loader Green** (`#24cb71`)：仅用于电池充电的 Loading 状态；加载完成后不可延续为页面装饰色。

### Neutral

- **Surface** (`#ffffff`)：浅色主题的完整底面。
- **Muted** (`#8f8f93`)：次级信息和正文动效中的低强调文本。
- **Quiet** (`#a1a1a4`)：时间、作者、摘要、说明性内容。
- **Line** (`#eeeeee`)：流式内容和区域之间的唯一分隔方式。
- **Dark Surface / Dark Ink** (`#181818` / `#f4f4f4`)：深色主题的成对替换；暗色模式同样保持单色体系。

**单色优先规则。** 除 Loading 绿外，不以黄色、渐变或高饱和点缀争夺内容注意力。

## Typography

系统字体以 SF Pro 与中文系统字体为主，保证身份、策展标题与长文在 macOS 中文环境中的一致字形。技术信号场独立使用等宽字体，且只服务于技术语义。

- **Display**（610，`clamp(2.05rem, 4.2vw, 3.85rem)`，1.04）：仅策展详情标题使用；最大负字距为 `-0.04em`。
- **Title**（620，`0.95rem`，1.15）：左侧姓名、列表区标题与轻量区域标题。
- **Stream headline**（570，`clamp(1.05rem, 1.5vw, 1.35rem)`，1.15）：策展信息流标题；使用 `text-wrap: balance`。
- **Body**（`0.78rem`–`0.96rem`，1.32–1.8）：简介、摘要与 Markdown 正文按阅读密度递进；简介正文可撑满身份轨，不再使用固定窄列。
- **Signal**（650，`0.62rem`）：仅技术词节点，不作为普通 UI 正文字体。

**语义字号规则。** 只有详情页 `h1` 可以使用 display 级别；首页内容通过粗细、留白和分隔线建立层级，不依赖超大标题。

## Elevation

本系统是**纯平面**的。层级来自网格、留白、细线与文本对比，不使用卡片阴影、毛玻璃或浮动面板。头像与媒体可使用 `12px` 小圆角承载真实图像，但不能叠加大阴影。

**平面优先规则。** 除媒体缩放、主题按钮 hover 与必要的状态反馈外，不为“看起来高级”添加阴影、描边加阴影组合或装饰性背景。

## Components

### 身份轨

- 左侧 `aside` 是全站稳定锚点：头像、姓名、GitHub、技术信号场、简介动效按固定顺序出现。
- 桌面使用 `position: sticky` 与 `100dvh`；详情页必须复用相同身份轨，不能出现第二套侧栏视觉语言。
- GitHub 是黑色实心 pill（`999px`），图标与文字同行；暂不加入语雀或其他外链来稀释身份焦点。

### 技术信号场

- 完整词库可保留在代码中，默认仅显示 12 个节点；节点必须错落排布且不得重叠。
- 使用点阵画布与低幅度透明度/位移动画，不可变成标签云、横向滚动条或规则矩阵。
- `prefers-reduced-motion` 下应显示静态内容。

### 双语简介

- Loading 后仅播放一次：英文标题与正文逐字显示 → 英文正文与标题逐字删除 → 空标题光标闪烁两次 → 中文标题与正文逐字显示并停留。
- 删除速率快于输入；最终可访问、可复制的稳定内容必须是中文。
- 正文宽度跟随身份轨，不保留人为最大宽度造成的右侧空白。

### 每日策展流

- 每条内容是一行信息流，不是卡片：日期/作者、标题/摘要、方向箭头三列组成。
- 行与行之间只用 `1px` 分隔线；hover 只改变文字和箭头位移，禁止增加背景卡、阴影或彩色条。
- 标题、摘要和链接保留真实来源与日期；内容密度由 `min-height: 9.5rem` 与上下 `1.65rem` 内边距维持。

### 策展详情

- 保持同一身份轨，右侧依次为返回、元信息、标题/摘要/标签、原始内容、深度解析、来源。
- Markdown 内容可以有阅读型排版、代码块与表格，但不得回退到旧版工作台/知识库壳层。

### Loading 与主题

- Loading 是根布局的一次性全屏遮罩：电池绿色 + 插画序列，完成后向上揭幕。
- 主题按钮为右上角无边框圆形图标；深色主题只交换黑白灰令牌，不创建另一套视觉语言。

## Do's and Don'ts

### Do:

- **Do** 以 `.curation-home` 的“身份轨 + 内容流”作为新页面的默认骨架。
- **Do** 在内容区使用连续分隔线、语义标题与真实元信息表达层级。
- **Do** 将新的技术词、简介内容与策展条目放进既有组件和数据模型，而不是另建展示壳。
- **Do** 为新的动效补齐 `prefers-reduced-motion` 的静态或即时状态。
- **Do** 先在桌面宽度验证两栏节奏、词节点不重叠、正文不留无意义右侧空白。

### Don't:

- **Don't** 恢复知识库、语雀同步、工作台表格或旧 `WorkspaceFrame` 视觉结构。
- **Don't** 用卡片网格、玻璃拟态、大阴影或高饱和装饰色承载策展内容。
- **Don't** 将 Loading 的绿色或此前试验的黄色扩散到加载完成后的页面。
- **Don't** 为技术感滥用等宽字体；等宽字体只属于技术信号场与代码语义。
- **Don't** 让技术节点、正文文本或详情标题溢出、堆叠或破坏两栏阅读线。
