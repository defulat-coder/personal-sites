---
version: 1
slug: "app-works-page-tsx"
primary_target: "app/works/page.tsx"
related_targets: ["components/works-stream.tsx","components/works.module.css","lib/works.ts","content/works/personal-site.md"]
---

# 我的作品（/works）surface brief

- Scope: app/works/**, components/works-stream.tsx, components/works.module.css, lib/works*.ts, content/works/*.md, public/images/works/。
- Mode: Experience——作品（真实页面截图）是第一主角，界面退后。
- 方向：案头卷宗（2026-08-16 impeccable 掷签 3d2abe48，dealt 7/1/6，用户按推荐锁定候选 6）。契约注释在 app/works/page.tsx 顶部。
- 结构：带 shots 的作品 = 卷宗块（题名+定位居上 / 截图样张带横滚 / 底栏登记+栈+出口）；无 shots = 紧凑登记行。shots 来自 content/works/*.md frontmatter（标注|站内路径）。
- 资产纪律：样张必须是运行中站点的真实截图（.scratch/capture-works-shots.mjs 可重拍，须隐藏 nextjs-portal），不用生成图冒充。
- 演进：作品数 ≥3 且每件都有样张时，可评估升级为「全宽展廊」；登记行是其天然降级形态。
- 未决：深色主题样张目前沿用浅色截图（媒体不随主题换色，与打印稿纸色同理）；如需深色样张再议。
- 2026-08-16 增补：样张可点击开灯箱（原生 dialog，Esc/背板/按钮退出，图源 2400w 与样张同源）；frontmatter `url` 渲染为底栏「在线访问」出口。
