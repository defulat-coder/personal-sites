---
name: 陈远｜每日关注
description: 面向 Agent 工程实践的个人身份轨与每日关注信息流。
colors:
  ink: "#1c1c1e"
  surface: "#ffffff"
  muted: "#656568"
  quiet: "#767676"
  summary: "#6f6f72"
  line: "#eeeeee"
  dark-surface: "#181818"
  dark-ink: "#f4f4f4"
  loader-green: "#24cb71"
  loader-red: "#ef4444"
  loader-amber: "#f2c94c"
  paper: "#f8f8f8"
  paper-dark: "#f6f2e9"
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
  scale:
    caption-xs: "0.67rem"
    caption-sm: "0.72rem"
    caption: "0.74rem"
    caption-lg: "0.76rem"
    body-sm: "0.78rem"
    body-md: "0.88rem"
    body-lg: "0.9rem"
    markdown-h3: "1rem"
    markdown-h2: "1.18rem"
    markdown-h1: "1.4rem"
    detail-h1-min: "1.45rem"
    detail-h1-fluid-min: "1.55rem"
    detail-h1-max: "1.85rem"
    detail-h1-fluid-max: "2.15rem"
    stream-h3-min: "0.88rem"
    stream-h3-max: "1rem"
rounded:
  micro: "0.09375rem"
  xs: "0.125rem"
  sm: "0.2rem"
  md: "0.25rem"
  lg: "0.3125rem"
  xl: "0.35rem"
  2xl: "0.4rem"
  3xl: "0.45rem"
  4xl: "0.5rem"
  5xl: "0.7rem"
  machine: "1.4rem"
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
    padding: "24px 0"
  tag:
    textColor: "#6f6f72"
    rounded: "{rounded.pill}"
    padding: "7px 10px"
---

# Design System: 陈远｜每日关注

## Overview

**Creative North Star: “运行中的工程档案”。** 这是一个以个人工程身份为锚点、以每日判断为主内容的桌面优先站点。页面不把内容包进卡片，也不使用营销式 hero；身份信息作为始终可见的左侧轨道，策展和文章作为右侧连续阅读流。

视觉参考来自 Ample Studio 的克制、轻量和留白节奏，但内容与交互服务于 Agent 工程实践：信号场传达技术广度，逐字叙事传达个人履历，策展流传达持续输入与判断。

- 高对比黑白灰为主体；绿色只属于 Loading 动画，不进入常规页面。
- 平面、细分割线、连续流；不要用卡片堆叠制造层级。
- 桌面两栏是主布局；窄屏才收敛为单栏。

## Colors

### Primary

- **Ink** (`#1c1c1e`)：标题、链接、按钮和主要内容。默认内容不引入额外品牌色。
- **Loader Green / Red / Amber** (`#24cb71` / `#ef4444` / `#f2c94c`)：仅用于电池充电的 Loading 状态（红→黄→绿充电序列）；加载完成后不可延续为页面装饰色。

### Neutral

- **Surface** (`#ffffff`)：浅色主题的完整底面。
- **Muted** (`#656568`)：次级信息和正文动效中的低强调文本。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起按要求加深。
- **Quiet** (`#767676`)：时间、作者、说明性元信息。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起按要求加深。
- **Summary** (`#6f6f72`)：摘要正文、标签、eyebrow 与 hover 降调文本；介于 Muted 与 Quiet 之间的中间灰。白底对比度 ≥4.5:1（WCAG AA），2026-08-15 起由 `#969699` 加深。
- **Paper** (`#f8f8f8`，深色 `#f6f2e9`)：仅关于我打印稿的纸面。
- **Error** (`#994545` 系列）：表单与数据错误的语义色，仅出错时使用。
- **Shadow/Overlay**：遮罩与打印阴影只用 `rgb(0 0 0 / N%)` 黑色透明度阶。
- **Line** (`#eeeeee`)：流式内容和区域之间的唯一分隔方式。
- **Dark Surface / Dark Ink** (`#181818` / `#f4f4f4`)：深色主题的成对替换；暗色模式同样保持单色体系。

**单色优先规则。** 除 Loading 绿外，不以黄色、渐变或高饱和点缀争夺内容注意力。

## Typography

系统字体以 SF Pro 与中文系统字体为主，保证身份、策展标题与长文在 macOS 中文环境中的一致字形。技术信号场独立使用等宽字体，且只服务于技术语义。

- **Display**（610，`clamp(2.05rem, 4.2vw, 3.85rem)`，1.04）：仅开屏等非内容场景使用，内容页标题一律用 Detail headline 档；最大负字距为 `-0.04em`。
- **Title**（620，`0.95rem`，1.15）：左侧姓名、列表区标题与轻量区域标题。
- **Stream headline**（500，`clamp(0.88rem, 0.95vw, 1rem)`，1.32，`-0.018em`）：信息流条目标题；使用 `text-wrap: pretty`。信息流标题保持克制，层级靠与摘要的粗细/颜色对比，不靠大字号。
- **Body**（`0.78rem`–`0.96rem`，1.32–1.8）：简介、摘要与 Markdown 正文按阅读密度递进；简介正文可撑满身份轨，不再使用固定窄列。
- **Signal**（650，`0.62rem`）：仅技术词节点，不作为普通 UI 正文字体。
- **Detail headline**（610，`clamp(1.55rem, 2.15vw, 2.15rem)`，1.16，`-0.038em`，`text-wrap: balance`）：内容详情页 h1。

**语义字号规则。** 内容页面的标题不使用 display 级别——长标题在超大字号下会失控；display 档仅保留给开屏等非内容场景。首页内容通过粗细、留白和分隔线建立层级，不依赖超大标题。

**字号阶梯。** frontmatter 的 `typography.scale` 是全站允许的字号清单（caption 0.67–0.76 / 正文 0.78–0.96 / Markdown 1–1.4 / 详情与信息流标题档）；新增字号先进清单再进代码，探测器以此为准。

## Elevation

本系统是**纯平面**的。层级来自网格、留白、细线与文本对比，不使用卡片阴影、毛玻璃或浮动面板。头像与媒体可使用 `12px` 小圆角承载真实图像，但不能叠加大阴影。

**平面优先规则。** 除媒体缩放、主题按钮 hover 与必要的状态反馈外，不为“看起来高级”添加阴影、描边加阴影组合或装饰性背景。

## Components

### 身份轨

- 左侧 `aside` 是全站稳定锚点：头像、姓名、GitHub、技术信号场、简介动效按固定顺序出现。
- 桌面使用 `position: sticky` 与 `100dvh`；详情页必须复用相同身份轨，不能出现第二套侧栏视觉语言。
- GitHub、语雀、问一问、关于我构成身份轨的链接行：quiet 文本 + 图标的同行链接，墨色 hover；问一问是其中唯一的站内动作，其余为外链或弹层。

### 内容导航

- 桌面内容区头部是刊头而非 tab：当前版块为 Title 档刊名（0.95rem/620/`-0.035em`）居左，兄弟版块为 quiet（`#767676`）`0.78rem` 同行链接居右，hover 与过渡中转墨色；整个头部共享唯一一条 `1px` 细线并保持 sticky。
- 刊头只承载阅读版块（每日动态/推特点赞/开源关注/构建）。**问一问是动作不是版块**：它归入身份轨链接行（与 GitHub、语雀、关于我同行），不在刊头的版块序列中出现；`/ask` 页的刊名仍是"问一问"，兄弟位留给阅读版块。
- 版块内筛选是索引行而非二级 tab：quiet 文本以 `·` 分隔，激活态只靠墨色与 620 字重，不加下划线、边框或第二条分隔线；开源关注的计数保留 tabular-nums。
- 窄屏（≤900px）沿用身份轨下方的横排移动导航（含首页链接），筛选行样式与桌面一致，触达高度 `2.2rem`。

### 今日快照

- 首页首屏是跨类型的近日时间轴（近 5 日、每日至多 8 条）：按日分组（日期标题用 Title 档 + quiet 星期/条数），条目登记栏左列是类型戳（动态/点赞/开源，620 字重）与时刻，右列只有标题——证明"每天都在场"的节奏而不展开内容。
- 每日动态体量远大于另两条流，超额时优先保留非动态条目与精选条目；快照不做分页，分区档案经刊头的兄弟链接进入。

### 技术信号场

- 完整词库可保留在代码中，默认仅显示 12 个节点；节点必须错落排布且不得重叠。
- 使用点阵画布与低幅度透明度/位移动画，不可变成标签云、横向滚动条或规则矩阵。
- `prefers-reduced-motion` 下应显示静态内容。

### 双语简介

- Loading 后仅播放一次：英文标题与正文逐字显示 → 英文正文与标题逐字删除 → 空标题光标闪烁两次 → 中文标题与正文逐字显示。正文稳定为中文后，标题以多语言问候语持续轮换。
- 删除速率快于输入；最终可访问、可复制的正文必须是中文；持续变换的多语言只用于标题问候语。
- 正文宽度跟随身份轨，不保留人为最大宽度造成的右侧空白。

### 关于我打印稿

- 身份轨底部（简介之后）有一个"关于我"触发器（打印机图标 + 文字按钮），点击后一张小票从触发器下方**逐段送出**：`clip-path` 配合 `steps()` 制造机械式走纸节奏；**每一行文字在走纸到达时瞬时以全浓度切出**（`about-line` 逐行延迟与走纸步数一一对应），不做淡入，也没有压线等覆盖物。
- 小票内容为两列网格：时间段+公司贴左列，描述贴右缘，两端对齐；附注行（如 OPT 一人团队）归属描述列并随右缘对齐。
- 小票是白色纸张（`#f8f8f8`），深色模式下也保持纸色——打印件不随界面换主题；顶部虚线撕边、底部 SVG 锯齿边，内容为等宽字体（打印语文义，不属于技术信号场的等宽规则）。
- 打印中触发器文案变为"打印中…"，完成后变为"收起"；再次点击或按 Esc 收卷（快速反向 `clip-path`）。
- `prefers-reduced-motion` 下小票直接完整出现，无走纸动画。

### 每日关注流

- 这是**判断流**：标题是他的判断式题名，策展解析是正文主角（`0.82rem`、`#3f3f42`），不是次要灰字——整条流读作他的批注，而不是他转发的列表。
- 每条内容是一行登记簿记录，不是卡片：左列是固定宽（`minmax(7rem,8.5rem)`）的 quiet 登记栏（日期、作者逐行，`0.72rem`），右列是标题与解析；不使用方向箭头，整行即是链接。
- 行与行之间只用 `1px` 分隔线；hover 只让标题转向墨色，禁止增加背景卡、阴影或彩色条。
- 标题、摘要和链接保留真实来源与日期；行密度由上下 `1.5rem` 内边距维持，三条内容流共用同一密度与栏宽。
- 窄屏（≤900px）收敛为单列：登记栏回到标题上方，以 `·` 分隔为一行。

### 策展详情

- 保持同一身份轨，右侧依次为返回、元信息、标题/摘要/标签、原始内容、深度解析、来源。
- Markdown 内容可以有阅读型排版、代码块与表格，但不得回退到旧版工作台/知识库壳层。

### Markdown 正文（全站统一）

- 所有长文 Markdown（策展解析、开源中文阅读版等）只用全局 `.article-markdown` 一套排版：正文 `.92rem`/`1.78`，标题 610/`-0.026em`（h1 `1.4rem` → h4 `.92rem`），代码块深色底、表格 `.82rem`。
- 问答等对话场景的 Markdown 可以用更密的正文（body 范围内），但标题字重/字距与 `.article-markdown` 同档。
- 新增 Markdown 场景不得再建第三套排版；模块级 Markdown 样式一律视为 drift。

### 每日动态流

- 这是**跟踪流**：新闻题名保持主角，摘要为 quiet 文摘——与判断流（每日关注、开源关注）的层级差异是有意的，判断流读他的文字，跟踪流读事件本身。
- 与每日关注流同构：按日分组（日期标题用 Title 档 + quiet 星期/条数），条目是 1px 分隔线的连续流，不做时间轴轨道、圆点或卡片。
- 条目结构与每日关注流同为登记簿：左列登记栏为时刻、出处（列表只显示出处名，@handle 留在详情页）、分类（「精选」只是登记栏里的一行 quiet 文本，不做徽章），右列 stream headline 标题与摘要；无方向箭头，不展示上游评分。
- 窄屏元信息以 `·` 分隔为一行，分隔点尾随在前一项之后，折行时行首不出现孤点。
- 滚动分页加载，新条目用 `data-appended` 渐入；空态、加载骨架、失败重试齐备。

### 每日动态详情

- 与策展详情共用身份轨与桌面滚动容器；顶栏只有返回与主题按钮（桌面隐藏顶栏主题按钮，避免与身份轨重复）。
- 结构：kicker（分类 · 精选，quiet 文本）→ detail headline 级 h1 → 元信息 → 导读 → 推荐理由（仅精选条目有数据，左侧 2px 引线）→ 实心 pill 原文出口（external-link 组件）+ quiet 域名。

### 开源关注流

- 与每日关注流同为**判断流**：左列登记栏为主题分类与状态（持续跟踪/已提炼/计划试用等），右列为仓库名（stream headline 档）、他的中文判读（正文主角，`0.82rem`、`#3f3f42`），以及一行 quiet 索引文本（维度 · 类型，以 `·` 分隔）。
- 不使用带边框的 tag 徽章，不使用方向箭头；行分隔线、hover 行为与窄屏收敛与另两条流一致。

### 构建版块

- `/works` 是稳定策展而非每日流：内容由作者在 `content/works/*.md` 亲手维护，不走 Supabase 管线，不进入首页 `?view=` 切换。
- 列表行与开源关注同构：左列元信息（时间段 · 状态），右列 stream headline 标题 + 一句话定位 + 技术栈 quiet 行；条目少，靠留白而非容器撑份量。
- 详情复用策展详情骨架（`curation-detail`）：元信息 + 技术栈 pill、标题/定位、正文用全局 `.article-markdown`，不新建排版。
- 数据流图等技术图示用代码块内的等宽 ASCII，不引入彩色插图。

### 问一问

- 对话页只有三个动词：问、等、读。组合器（shadcn `InputGroup`）常驻 sticky 底部并包含底部安全区，任何设备上输入框都不滚走。
- 检索范围在组合器底部左侧（`DropdownMenu`）：触发器显示当前范围，点击向上展开单选列表（全部/每日动态/推特点赞/开源关注）；不使用平铺的分段控件。
- 用户消息是右侧墨泡（短文本）；助手回答是全宽阅读面（长文 Markdown），不是气泡；说话人由对齐方向表达，铭牌只做 sr-only。
- 空状态的建议问题是首屏产品：通栏细线行、移动端 2.75rem 触达；引用来源是细线列表，保留焦点环。
- 移动端触达目标 ≥2.75rem（发送、范围、建议、引用），输入字号 `1rem` 避免 iOS 聚焦缩放。

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
