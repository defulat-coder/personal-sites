---
type: Source System
title: Codex 与 Claude Code 本地历史
description: 本地 Agent 会话、持久记忆、提示历史与 OKF 可读投影的来源边界。
tags: [agent-history, codex, claude-code, okf]
timestamp: 2026-07-18T00:00:00+08:00
visibility: private
review_status: approved
---

# Codex 与 Claude Code 本地历史

这个来源汇总当前用户目录下的 Codex 和 Claude Code 本地历史。它服务于个人知识回溯，不等同于网站公开内容。

## Storage

- 完整 Raw：`data/private/agent-history/raw/`
- 私有 OKF：`knowledge/private/personal/agent-history/`
- 同步范围：`config/agent-history-sync.json`
- Raw 清单：`data/private/agent-history/raw/manifest.json`

Raw 会话、记忆和索引按 SHA-256 内容寻址保存。Codex `memories_1.sqlite` 使用 SQLite 在线备份取得一致性快照，`stage1_outputs` 逐 thread 导出并同时保留 `raw_memory` 和 `rollout_summary`。OKF 会话正文只投影用户与助手文本，同时保留 session ID、工作目录、时间、模型、compaction summary 和 Raw 哈希。系统/开发者消息、推理、工具调用与工具结果只在 Raw 中保留。

## Update

```bash
npm run data:update:agent-history
```

该命令同步本地来源、校验 Raw、重建统一 OKF Bundle，并验证逐条 Concept 与 Raw manifest 的对应关系。未变化文件被复用；新增、追加、移动、修改或源端删除会留下明确变更记录。完整逐字节 Raw 校验可运行 `node scripts/verify-agent-history.mjs --full`。

## Privacy

Agent 历史可能包含私有源码、终端内容、个人对话和敏感信息，因此 Raw 和生成的完整 OKF 都被 Git 忽略，Concept 固定标记为 private。任何公开使用都需要单独人工审批和脱敏。
