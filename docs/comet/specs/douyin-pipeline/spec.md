# 抖音策展管道（douyin-pipeline，同步即发布后的完整规格）

抖音收藏作为「每日关注/抖音收藏」的关注来源，管道为：收藏发现与下载（sidecar）→ 本地多模态分析（mcp-video-analyzer）→ AI 策展草稿 → **自动批准** → 公开投影重建。不再设人工审核闸门。

## 同步（douyin:curation sync）

- 每条新处理视频完成分析后，队列条目的 `review` 直接写入 `{ approved: true, reviewedAt: <完成时间> }`；无需人工 `approve`
- 已有条目默认跳过；`--force` 重新分析时保留既有批准状态（`toReviewItem` 既有契约不变）
- sync 结束且本轮有新增条目时，自动执行 `scripts/build-curation-sqlite.mjs` 重建公开投影（等价 `pnpm curation:publish`）；无新增时跳过重建
- `douyin:sync`（全量/增量编排）经由 `douyin:curation sync` 子进程继承上述行为，不单独实现
- 分析失败仍记录 `analysis-failures.json`，失败条目不进入队列也不发布

## 审核命令（保留）

- `list` 继续列出全部条目及其批准状态；`approve <id...>` 继续可用于手工修正
- 不再有「待审核」状态的常规条目；`list` 输出主要作为回查

## 数据边界

- 原始视频、转写、关键帧、OCR、review-queue、`analysis-failures.json` 全部留在 `data/sensitive/douyin-curation/`（私有层，不进 Git）
- 公开投影 `data/curation.sqlite` 的字段集合不变：标题、摘要、解析、来源摘录、标签、链接、作者与来源元数据
- 未核验的 `mentionedProjects` 实体候选不进入公开投影（维持现状）
- 「问一问」索引继续从公开投影派生，自动包含新发布的抖音条目
