# 敏感数据边界

本项目的展示系统与本地资料管道共存。原始个人资料可以继续保存在本机，但不能进入 Git 索引、提交、推送、构建产物、截图或公开投影。

## 目录约定

`sensitive` 是敏感数据的明确目录名；`raw` 表示其中未经公开审查的原始证据层。

| 路径 | 内容 | 处理规则 |
| --- | --- | --- |
| `data/sensitive/personal/` | 简历、联系方式、个人叙事源稿 | 仅本机保存，禁止 Git |
| `data/sensitive/agent-history/` | 原始会话与任务历史 | 仅本机保存，禁止 Git |
| `data/sensitive/github/` | GitHub 同步快照、响应和仓库原始内容 | 仅本机保存，禁止 Git |
| `data/sensitive/yuque/` | 语雀同步对象、附件和原始文档 | 仅本机保存，禁止 Git |
| `data/sensitive/x-curation/` | X 书签/点赞原文、媒体、策展队列和生成备份 | 仅本机保存，禁止 Git |
| `data/curation.sqlite` | 已完成脱敏并已在站点公开的 X 策展投影 | 随代码提交；仅部署端只读查询 |
| `knowledge/sensitive/` | 私有知识库及其个人来源分区 | 仅本机保存，禁止 Git |
| `tools/smaug/.state/` | 抓取游标、待处理书签和运行状态 | 仅本机保存，禁止 Git |
| `tools/smaug/smaug.config.json` | 本地抓取配置和凭据 | 仅本机保存，禁止 Git |
| `tools/smaug/bookmarks.md` | 本地书签归档 | 仅本机保存，禁止 Git |
| 私有 Supabase Storage `ask-sessions` | 匿名问答 JSONL 会话与模型生成记录 | 仅服务端 service role 可读写，禁止浏览器、Git 与公开链接 |

X 策展不再使用 `data/public/` 作为页面数据源。经 Pi Agent 解析完成后，敏感原始队列继续只保留本机；只有与当前站点展示字段完全一致的公开投影会写入 `data/curation.sqlite`。原始抓取文件、敏感队列及本地凭据永远不会进入 Git 或浏览器。

## 防护约束

- 根目录 `.gitignore` 覆盖所有上述路径；旧名称 `data/private/` 和 `knowledge/private/` 也继续忽略，防止旧 checkout 重新引入敏感数据。
- `config/git-safety.json` 将敏感目录和本地凭据列为阻断项。即使使用 `git add --force`，安全检查也会失败。
- `.githooks/pre-push` 在推送前运行 `scripts/verify-git-safety.mjs`，检查暂存区、工作区候选文件和可达历史对象。
- 根目录个人简历已移入 `data/sensitive/personal/resume.md` 并从 Git 索引移除；页面代码仍保留，不读取该源文件。
- 网站运行时、浏览器验证、构建输出和截图不得读取或复制 `data/sensitive/`、`knowledge/sensitive/`、凭据配置或原始会话。
- 在 Vercel 上，问答会话只在 `/tmp/ask-sessions` 中短暂恢复和运行；请求结束后回写私有 Supabase Storage，不能依赖 Function 本地磁盘作为持久化层。

## 操作检查

```bash
git check-ignore -v data/sensitive/personal/resume.md
pnpm git:safety
```

如果安全检查报告敏感路径，必须先移出暂存区并确认它未出现在待推送提交中；不能通过改名、强制添加或删除当前工作区文件来绕过检查。

当前仓库历史曾包含根目录简历，因此带 `--range HEAD` 的历史检查会故意失败；这意味着在完成历史清理前，pre-push 会阻止任何推送。历史重写和远程分支更新属于单独的高风险操作，本次只建立防护，不自动执行。
