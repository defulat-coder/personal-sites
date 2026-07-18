# 个人网站数据层

网站不会直接读取简历、GitHub 或语雀原文。数据分为三层：

1. **Source / Raw**：尽可能保真地保存外部来源，不做内容改写。
2. **OKF / Knowledge Bundle**：按 Open Knowledge Format 把资料组织成可阅读、可链接的知识概念。
3. **Public / Published**：只包含人工确认、完成脱敏、允许在网站公开的内容。

## 数据源

数据源注册表位于 [`sources.json`](./sources.json)。当前包括：

- 旧简历；
- GitHub 自有、Starred、Watched 项目；
- 语雀个人知识库、文档、目录、小记以及正文引用的可下载资源。

语雀原始数据写入 `data/private/yuque/raw/`，GitHub 原始清单写入 `data/private/github/raw/`。这些目录位于项目内，但被 Git 忽略，不能被前端直接打包，也不能进入未来的公开仓库。若要长期版本化原始资料，应使用单独的私有内容仓库。

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

## OKF 知识层

OKF 约定和 Bundle 入口见 [`../knowledge/README.md`](../knowledge/README.md)。`npm run data:build:okf` 会把当前语雀与 GitHub Raw 快照原子合成为同一个私有 Bundle。原始资料永远是证据层；OKF 是可重建的知识视图，不能反向覆盖原始资料。
