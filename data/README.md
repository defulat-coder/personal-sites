# 个人网站数据层

网站不会直接读取简历、GitHub 或语雀原文。数据分为三层：

1. **Source / Raw**：尽可能保真地保存外部来源，不做内容改写。
2. **OKF / Knowledge Bundle**：按 Open Knowledge Format 把资料组织成可阅读、可链接的知识概念。
3. **Public / Published**：只包含人工确认、完成脱敏、允许在网站公开的内容。

## 数据源

数据源注册表位于 [`sources.json`](./sources.json)。当前包括：

- 旧简历；
- GitHub 公开项目；
- 语雀个人知识库、文档、目录、小记以及正文引用的可下载资源。

语雀原始数据写入 `data/private/yuque/raw/`。这个目录位于项目内，但被 Git 忽略，不能被前端直接打包，也不能进入未来的公开仓库。若要长期版本化原始资料，应使用单独的私有内容仓库。

## 语雀同步

同步程序只从环境变量读取凭据：

```bash
export YUQUE_TOKEN="..."
npm run data:sync:yuque
npm run data:verify:yuque
```

同步范围配置在 [`../config/yuque-sync.json`](../config/yuque-sync.json)，配置文件不得包含 Token。输出采用内容寻址存储，同一份源数据重复同步不会产生不同的 manifest。

“全量”以 `coverage.json` 为准：它必须明确列出知识库、文档、小记、目录、YMD 正文、附件的成功数和失败数。任何分页、权限或下载失败都必须显示为未完成，不能静默跳过。

## OKF 知识层

OKF 约定和 Bundle 入口见 [`../knowledge/README.md`](../knowledge/README.md)。原始资料永远是证据层；OKF 是可重建的知识视图，不能反向覆盖原始资料。
