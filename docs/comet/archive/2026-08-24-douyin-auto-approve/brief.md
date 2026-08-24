# Outcome

抖音策展管道从「人工审核闸门」改为「同步即发布」：`douyin:curation sync` 生成的草稿自动标记为已批准，同步完成后自动重建公开投影；存量 859 条待审草稿一次性全部批准并发布。站点「抖音收藏」板块随下次部署展示全部已同步条目。

# Scope

- `scripts/douyin-curation.mjs` 的 sync 阶段：新写入队列的条目直接 `review.approved = true`（记录 `reviewedAt`）
- sync 完成且有新增条目时，自动执行公开投影重建（等价于 `pnpm curation:publish`，即 `scripts/build-curation-sqlite.mjs`）；无新增时不重建
- 存量队列条目一次性批准（数据操作，本 change 执行一次）：全部 864 条进入公开投影
- 测试同步更新：`tests/douyin-curation-split.test.ts` 不再硬编码 5 条；必要时补充 sync 自动批准行为的覆盖
- 文档同步：`docs/douyin-curation.md` 改写为默认自动批准与自动发布语义

# Non-goals

- 不改实体核验/项目候选逻辑（`mentionedProjects` 仍按原样随草稿发布，不新增核验步骤）
- 不改 X 来源管道与 `curation:sync` 系列脚本
- 不改站点代码（`/douyin` 板块已在 douyin-section change 归档）
- 不做 Supabase 推送（策展公开投影只读本地 sqlite，随部署打包）
- 不删除 `list`/`approve` 命令（保留回查与手工修正能力）

# Acceptance examples

- B1：`douyin:curation sync` 新产生的队列条目 `review.approved === true` 且带 `reviewedAt`，无需人工 `approve`
- B2：sync 有新增条目时自动重建公开投影；无新增（全部已处理）时不触发重建
- B3：存量处理完成后，`data/curation.sqlite` 中 `douyin-%` 条目数等于队列条目总数（当前 864）
- B4：`approve` / `list` 命令保持可用；`--force` 重新分析时已批准状态保留
- B5：私有边界不变——原始视频、转写、OCR、review-queue 留在 `data/sensitive/`，公开投影字段集合不变
- B6：`pnpm typecheck`、`pnpm lint`、`pnpm test`、`pnpm build` 全部通过
- B7：`docs/douyin-curation.md` 与实际行为一致（默认自动批准 + 自动发布）

# Constraints and invariants

- 遵守 `docs/sensitive-data.md`：私有层数据不进入 Git、浏览器、Vercel 或 Supabase 公开投影之外的任何位置
- `modules/douyin-sync/import.mjs` 的 `toReviewItem` 默认值保持 `approved: false`（既有测试契约）；自动批准在 sync 编排层实施
- 公开投影字段 schema 不变，iOS/Android 客户端无需更新
- 用户已明确知悉并接受：未核验的 AI 草稿（含可能错误的项目身份）将直接公开

# Decisions

- Q1（存量）：859 条待审草稿立即全部批准并重新发布，站点下次部署展示全部 864 条
- Q2（环节）：sync 时自动批准 + 自动重建公开投影；线上内容仍随部署生效
- 风险确认：用户明确「数据默认审核通过，不需要审核」，接受未核验草稿直接公开的后果
- 工作区：当前目录；前一个 active change（douyin-section）已归档，目录无冲突

# Open questions

（无未解决问题；目标、范围与验收项已于 2026-08-25 经用户明确确认）

# Verification expectations

- 四项检查全过
- 数据操作后核对 sqlite 中 douyin 条目数与队列一致；dev 运行时 `/douyin` 与 `/api/douyin` 返回全部条目且分页可用（hasMore=true）
- sync 自动批准与自动发布逻辑以测试或受控运行验证
