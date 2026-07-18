# 个人网站数据层

网站不会直接读取简历、GitHub 或语雀原文。数据分为三层：

1. **Source / Raw**：尽可能保真地保存外部来源，不做内容改写。
2. **OKF / Knowledge Bundle**：按 Open Knowledge Format 把资料组织成可阅读、可链接的知识概念。
3. **Public / Published**：只包含人工确认、完成脱敏、允许在网站公开的内容。

## 数据源

数据源注册表位于 [`sources.json`](./sources.json)。当前包括：

- 旧简历；
- GitHub 自有、Starred、Watched 项目；
- 语雀个人知识库、文档、目录、小记以及正文引用的可下载资源；
- Codex 与 Claude Code 的本地会话、持久记忆、提示历史和会话索引。

语雀原始数据写入 `data/private/yuque/raw/`，GitHub 原始清单写入 `data/private/github/raw/`，Agent 历史写入 `data/private/agent-history/raw/`。这些目录位于项目内，但被 Git 忽略，不能被前端直接打包，也不能进入未来的公开仓库。若要长期版本化原始资料，应使用单独的私有内容仓库。

## GitHub 仓库与 Raw 备份边界

本仓库提交到 GitHub 的范围只包括代码、配置、说明文档和经过审核的公开内容。下列内容必须留在 Git 之外：

- `data/private/`：语雀、GitHub、Codex 和 Claude Code 的完整 Raw 证据；
- `knowledge/private/`：包含来源正文和历史会话的私有 OKF Bundle；
- `node_modules/`、`.next/`、`out/`、测试报告和其他可重建产物；
- `.env*`（仅允许 `.env.example`）以及本机 Codex 配置。

提交前运行：

```bash
npm run git:safety
npm run git:hooks:install
```

正常执行 `pnpm install` 或 `npm install` 时，`prepare` 会为新 clone 自动启用仓库内 hook；上面的安装命令可用于显式安装或修复。检查器只读取 Git 索引、Git tree、文件路径和大小，不遍历或读取被忽略的私有 Raw 内容。它会阻止私有目录被强制加入 Git、阻止关键忽略规则被删除，并在普通文件超过 50 MiB 时提前失败；GitHub 对大于 100 MiB 的普通 Git 文件会直接阻止推送。安装的 pre-push hook 会在上传前扫描待推送分支的全部可达历史，GitHub Push 和 Pull Request 也会用完整历史重复校验，因此“先提交私有文件、后删除再一起推送”仍会被阻止。阈值和受保护路径统一配置在 [`../config/git-safety.json`](../config/git-safety.json)。

`.gitignore` 不是备份。私有 Raw 应另外保存到加密磁盘或客户端加密的对象存储，并保留至少一个不与当前工作目录共盘的副本；不要把 GitHub 私有仓库当作这批 Raw 的默认备份。**当前外部备份尚未配置**：本次护栏只负责防止误提交，不会假装资料已经备份。需要你指定目标磁盘或对象存储后，才能安全配置并验证真实备份。

## 语雀同步

同步程序只从环境变量读取凭据：

```bash
export YUQUE_TOKEN="..."
npm run data:sync:yuque
npm run data:verify:yuque
```

同步范围配置在 [`../config/yuque-sync.json`](../config/yuque-sync.json)，配置文件不得包含 Token。输出采用内容寻址存储，同一份源数据重复同步不会产生不同的 manifest。

“全量”以 `coverage.json` 为准：它必须明确列出知识库、文档、小记、目录、YMD 正文、附件的成功数和失败数。任何分页、权限或下载失败都必须显示为未完成，不能静默跳过。

## GitHub 增量同步

GitHub 同步复用本机 `gh` CLI 已登录的账号，不把 Token 写入配置、Raw 或 Git：

```bash
gh auth status
npm run data:update:github
```

同步范围配置在 [`../config/github-sync.json`](../config/github-sync.json)，默认覆盖：

- 当前账号拥有的全部仓库，包括私有仓库；
- Starred 仓库；
- Watched / Subscribed 仓库。

Raw 目录结构支持后续更新：

- `manifest.json`：当前完整清单、覆盖状态、关系和本次变更；
- `state.json`：最近检查时间、最近变更时间和当前 manifest 哈希；
- `responses/`：`gh api` 返回的账号、Owned、Starred、Watched 完整 JSON 响应证据；
- `objects/repository/`：按内容哈希保存的不可变仓库对象；
- `blobs/readme/`：符合条件的自有非 Fork 仓库 README 证据；
- `snapshots/`：只在清单发生变化时新增的历史 manifest。

同一 GitHub 数字仓库 ID 只保存一条归一化记录，完整 API 响应仍按内容哈希保留为 Raw 证据。Owned、Starred、Watched 是仓库的关系。后续同步会记录新增、元数据更新、关系增加/移除、重新激活；失去全部关系的仓库会转为 inactive 历史，而不是被静默删除。某个集合请求失败时，同步器会保留上一次已知关系并把 manifest 标记为 incomplete，防止网络故障被误判成批量取消关注。README 抓取属于可选证据，其告警会记录但不会阻断仓库清单更新；告警恢复后 manifest 会清除旧状态。

## Codex 与 Claude Code 历史同步

历史同步直接读取当前用户目录中的本地数据，不需要额外 Token：

```bash
npm run data:update:agent-history
```

同步范围配置在 [`../config/agent-history-sync.json`](../config/agent-history-sync.json)。当前覆盖 Codex 的 active/archived 会话、会话索引、`~/.codex/memories` 文件和 `memories_1.sqlite`，以及 Claude Code 的项目会话、全局提示历史、会话元数据和全局 `CLAUDE.md`。如果以后 Claude Code 出现项目级 `memory/MEMORY.md`，同步器也会自动纳入。

Codex SQLite 记忆使用 `sqlite3` 在线备份生成一致性快照，再把 `stage1_outputs` 按 thread ID 稳定导出为独立 Raw 对象和 OKF Memory Concept。数据库缺失、备份失败、完整性检查失败或导出失败都会令 manifest 变为 `complete: false` 并阻断 Bundle 重建，不能以文件目录正常为由掩盖数据库记忆缺口。运行更新命令的环境需要能从 `PATH` 调用 `sqlite3`；macOS 系统默认提供。

Agent 历史分成两种用途不同的数据：

- `data/private/agent-history/raw/` 是完整私有证据层。会话 JSONL 和记忆文件按 SHA-256 内容寻址保存，系统消息、开发者消息、推理、工具调用和工具结果都不会丢失；
- `knowledge/private/personal/agent-history/` 是可读 OKF 投影。会话正文只保留用户与助手文本，另保留 compaction summary、来源路径、工作目录、时间、模型和 Raw 哈希；
- `manifest.json` 是当前完整清单，`state.json` 保存最近 manifest 哈希，`snapshots/` 只在清单变化时增加，`objects/` 保存可读投影；
- Codex `memories_1.sqlite` 的一致性备份作为 Raw 索引保存，每条阶段记忆同时保留 `raw_memory` 与 `rollout_summary`；
- 会话 Concept ID 使用“平台 + session ID”，会话追加或从 active 移到 archive 后路径不变；记忆 Concept ID 使用“平台 + 类型 + 来源路径”哈希；
- 未变化的来源按文件大小和修改时间复用，不重新扫描；新增、追加、移动和修改才生成新 Raw 对象。源文件消失会转为 inactive 历史，不会静默删除。

首次同步需要读取全部本地历史，耗时和磁盘占用取决于会话体积；后续更新主要复用已有内容。快速校验使用 `npm run data:verify:agent-history`，需要逐字节重算所有 Raw SHA-256 时运行：

```bash
node scripts/verify-agent-history.mjs --full
```

历史内容可能含源码、终端输出、凭据痕迹和私人对话，因此 Raw 与完整 OKF Bundle 都保持 private；公开到个人网站必须另行逐条审核和脱敏。

## OKF 知识层

OKF 约定和 Bundle 入口见 [`../knowledge/README.md`](../knowledge/README.md)。`npm run data:build:okf` 会把当前语雀、GitHub 与 Agent 历史 Raw 快照原子合成为同一个私有 Bundle。原始资料永远是证据层；OKF 是可重建的知识视图，不能反向覆盖原始资料。
