# Design Decisions

人工裁决的只追加日志。格式见 design-loop 技能的 references/decisions-format.md。

## 2026-08-15 · 每日动态流（列表 + 详情）

裁决（用户原话）：「各个子 table 以及列表中的标题感觉特别大特别丑」。

结论：信息流条目标题从 stream headline 大字号档降为每日关注流的实际值（500 / clamp(0.88rem, 0.95vw, 1rem) / 1.32 / pretty）；详情 h1 从 display 档降为策展详情实际值（610 / clamp(1.55rem, 2.15vw, 2.15rem) / 1.16 / balance）。DESIGN.md 的 stream headline 与 display 使用规则已同步修正：内容页标题不使用 display 档，信息流层级靠粗细/颜色对比而非大字号。

## 2026-08-15 · 首访动画链（Loading + 双语打字）

裁决（用户原话）：「首访动画链这个是我特意要的，不要做任何改动，留着」。

结论：OpeningLoader + 双语逐字简介的完整动画链是有意设计，**不加跳过按钮、不缩短、不改变节奏**。后续任何评审/优化不得再将其列为问题。

