---
version: 1
slug: "app-works-page-tsx"
primary_target: "app/works/page.tsx"
related_targets: ["components/works-stream.tsx","components/works.module.css","lib/works.ts","modules/project-sync/source.mjs","modules/project-sync/derive.mjs","modules/project-sync/publish.mjs","config/project-catalog.mjs"]
---

# 构建（/works）surface brief

- Scope: app/works/**, components/works-stream.tsx, components/works.module.css, lib/works*.ts, modules/project-sync/**, config/project-catalog.mjs, public/images/works/。
- Mode: Experience——作品（真实页面截图）是第一主角，界面退后。
- 方向：案头卷宗（2026-08-16 impeccable 掷签 3d2abe48，dealt 7/1/6，用户按推荐锁定候选 6）。契约注释在 app/works/page.tsx 顶部。
- 结构：项目是唯一根上下文。带 shots 的项目 = 卷宗块（题名+定位 / 截图样张带 / 当前关注+最近三条项目记录 / 底栏登记+栈+出口）；无 shots = 含当前关注与最近记录的紧凑登记行。详情用项目内文字索引与登记簿行展开能力、实验、决策、实践、里程碑及所属证据。
- 数据：本机 Git、允许文档和 Codex 项目记录先生成私有证据摘要与待审草稿；只有显式批准的项目级快照写入 Supabase `project_public_snapshots`。列表和详情都不回退到本机证据或敏感目录。
- 增量语义：项目证据 `sourceDigest` 与提炼器版本都未变时复用草稿且不调用模型；采集状态、已批准材料与公开修订分开保存。公开数据只在显式 `--publish` 时按项目 upsert 并回读验证；重复发布同一 `revision` 仍会刷新 `published_at`，回读失败不会自动回滚已完成的 upsert。
- 资产纪律：样张必须是运行中站点的真实截图（.scratch/capture-works-shots.mjs 可重拍，须隐藏 nextjs-portal），不用生成图冒充。
- 演进：项目数 ≥3 且每件都有样张时，可评估升级为「全宽展廊」；登记行是其天然降级形态。跨项目索引只能从公开快照派生，不能变成新的内容真相来源。
- 未决：深色主题样张目前沿用浅色截图（媒体不随主题换色，与打印稿纸色同理）；如需深色样张再议。
- 2026-08-16 增补：样张可点击开灯箱（原生 dialog，Esc/背板/按钮退出，图源 2400w 与样张同源）；公开快照 `url` 渲染为底栏「在线访问」出口。
- 2026-08-16 增补：样张带横向滚动联动中心强调（Motion `useTransform`，居中样张 opacity/scale 满值、两侧收敛至 0.6/0.96）；悬停样张带时纵向滚轮转横向滚动（原生非 passive wheel 监听，滚到两端放行页面纵向滚动）；reduced-motion 下不挂监听、强制满值静态呈现。
- 2026-08-16 增补：样张带自动漂移横滚（rAF，24px/s，到端点折返；悬停/聚焦暂停，手动滚动后 2.6s 恢复）。注意：`scrollLeft` 读回取整，亚像素位移必须自维护逻辑位置再 `Math.round` 写入，否则漂移卡死。
