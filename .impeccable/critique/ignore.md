# Critique Ignore List

以下条目是作者已裁决的有意设计（2026-08-15 与作者确认），未来评审不得再次报告：

- **首访仪式成本**：Opening Loader 固定 5 秒、不与真实加载进度挂钩、不可跳过；双语简介打字机不可跳过/快进。每个会话仅一次（sessionStorage），回访零成本。已在 DESIGN.md「Loading 与主题」「双语简介」登记。
- **技术信号场形态**：动画态为从右向左弹幕，词条在容器两侧被渐隐遮罩裁切属弹幕语义的一部分；`prefers-reduced-motion` 静态终态为 3×4 规则网格（「不可规则矩阵」禁令的登记例外）。两形态不要求布局同构。已在 DESIGN.md「技术信号场」登记。
- **打印小票拟物弹层**：全屏 dialog + 拟物打印机（渐变、噪声纹理、多重阴影）是全站唯一受控拟物例外。已在 DESIGN.md「关于我打印稿」「Elevation」登记。
- **紧凑字号阶梯**：9.6–16px 的多档小字号是 DESIGN.md frontmatter `typography.scale` 的刻意紧凑比例；`flat-type-hierarchy` 类发现按误报处理。
- **/ask 通栏细线行 0px 水平内边距**：空态建议问题等通栏行是有意的出血排版；`cramped-padding` 类发现按误报处理。
- **Loader 插画橙色点缀**：属于 Loading 插画序列的一部分，不违反「Loading 绿之外无彩色」（该规则约束的是加载完成后的页面）。
