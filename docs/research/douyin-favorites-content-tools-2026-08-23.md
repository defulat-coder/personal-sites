# 从抖音收藏视频提取项目与知识条目的 GitHub 工具调研（2026-08-23）

## 结论

用户要的不是“下载抖音收藏”，而是：读取自己的收藏视频，结合语音、画面和屏幕文字理解内容，把其中提到的项目、产品、开源仓库和链接逐项摘出，整理成本站可审核的“每日关注”或“开源关注”条目，并最终供“问一问”检索。

截至 2026-08-23，GitHub 上**没有一个成熟、宽松许可的项目能开箱完成“抖音收藏 → 中文短视频多模态理解 → 软件项目识别与链接核验 → 写入本站现有模型”整条链路**。但已有非常接近的端到端参考和可组合组件：

1. **最接近最终产品形态：[`guimatheus92/social-knowledge-base`](https://github.com/guimatheus92/social-knowledge-base)。** 它把短视频同时“看”（关键帧、OCR）和“听”（转写），为每条视频生成带 `themes`、`entities`、摘要、要点、屏幕文字和带时间戳原话的 Markdown 笔记，再建立可搜索的 RAG 知识库。[完整链路](https://github.com/guimatheus92/social-knowledge-base#how-it-works)；[笔记 contract](https://github.com/guimatheus92/social-knowledge-base/blob/main/prompts/build-notes.md)；[MIT License](https://github.com/guimatheus92/social-knowledge-base/blob/main/LICENSE)
2. **最适合直接集成的证据提取层：[`guimatheus92/mcp-video-analyzer`](https://github.com/guimatheus92/mcp-video-analyzer)。** 它接受本地 MP4 或 TikTok 等 URL，CLI 输出稳定 JSON，包含 `metadata`、`transcript`、关键帧、`ocrResults`、统一 `timeline` 和 `warnings`；也支持批处理与 sidecar 恢复。[CLI JSON 输出](https://github.com/guimatheus92/mcp-video-analyzer#cli-one-shot-no-mcp-client)；[类型定义](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/src/types.ts)；[MIT License](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/LICENSE)
3. **可用作实体/关系抽取层：[`penfieldlabs/pengram`](https://github.com/penfieldlabs/pengram)。** PENgram 能接收本地音视频或已经整理好的文档，用 Whisper 转写，再用 LLM 抽取实体、主题与带置信度的类型化关系，输出 `graph.json`、报告和 Obsidian/Penfield vault。[三阶段架构与输入](https://github.com/penfieldlabs/pengram#how-it-works)；[输出](https://github.com/penfieldlabs/pengram#output-formats)；[MIT License](https://github.com/penfieldlabs/pengram/blob/main/LICENSE)

推荐的真实组合是：

```text
抖音收藏下载器（只负责输入）
  → 本地 MP4 + 作品 JSON + 原始链接
  → mcp-video-analyzer（转写 + 关键帧 + OCR + 时间线）
  → 自有 mentionedProjects[] 结构化抽取
     可借 social-knowledge-base 的 note contract
     可借 PENgram 的实体/关系与置信度设计
  → GitHub 官方仓库身份和 URL 独立核验
  → 人工审核
  → 每日关注 / 开源关注公开投影
  → 已发布内容派生“问一问”检索索引
```

## 必须区分的四层

| 层 | 输入与输出 | 候选 | 是否解决“摘出项目” |
|---|---|---|---|
| 收藏发现与下载 | 登录态收藏 → 视频、作品描述、作者、源链接 | `jiji262/douyin-downloader`、`f2` | 否 |
| 多模态证据提取 | 视频 → 转写、关键帧、OCR、时间线 | `mcp-video-analyzer`、`video-extract-mcp`、`OmniScribe` | 只提供证据 |
| 语义与实体整理 | 证据 → 项目/产品候选、摘要、关系、引用 | `social-knowledge-base`、PENgram | **是，但仍需定制 schema** |
| 核验与本站发布 | 候选 → 官方仓库核验、去重、人工批准、公开字段 | 当前项目自己的审核与发布边界 | 外部项目不能替代 |

此前调研的 [`jiji262/douyin-downloader`](https://github.com/jiji262/douyin-downloader) 只应保留在第一层。它能读取当前账号默认收藏和自定义收藏夹，下载视频、原声和 JSON，也能调用音频转写 API；但没有关键帧、OCR、多模态归因、项目实体 schema、仓库核验或知识库投影。[收藏功能](https://github.com/jiji262/douyin-downloader/blob/main/README.zh-CN.md#%E6%89%B9%E9%87%8F%E4%B8%8B%E8%BD%BD%E5%BD%93%E5%89%8D%E7%99%BB%E5%BD%95%E8%B4%A6%E5%8F%B7%E6%94%B6%E8%97%8F%E5%A4%B9%E4%BD%9C%E5%93%81)；[转写功能](https://github.com/jiji262/douyin-downloader/blob/main/README.zh-CN.md#%E5%8F%AF%E9%80%89%E5%8A%9F%E8%83%BD%E8%A7%86%E9%A2%91%E8%BD%AC%E5%86%99transcript)

## 重点候选

### 1. `social-knowledge-base`：最佳参考架构

这是本轮最接近用户描述的项目，而不是普通转写器：

- 每条本地视频经过 transcript、frames、OCR 和 timeline 后生成独立 Markdown 笔记；一条一条处理，支持中断恢复。[工作方式](https://github.com/guimatheus92/social-knowledge-base#how-it-works)
- 规范模板直接包含 `themes` 与 `entities`，正文有 Summary、Key takeaways、On-screen text 和 Spoken excerpts，并要求真实时间戳。[模板源码](https://github.com/guimatheus92/social-knowledge-base/blob/main/prompts/build-notes.md)
- 后续生成按主题汇总的 `OVERVIEW.md`，并对 transcripts/notes 建索引和查询脚本。[README](https://github.com/guimatheus92/social-knowledge-base#usage-cli)
- 仓库已有 TikTok provider，但整账号工作流目前仍以 Instagram 为主；下载层可替换成本项目的抖音收藏 sidecar。[provider 源码](https://github.com/guimatheus92/social-knowledge-base/blob/main/app/src/server/providers/index.ts)
- 最近提交为 2026-06-29（[`c3e09c3`](https://github.com/guimatheus92/social-knowledge-base/commit/c3e09c3e8567146be8a06c3ad2c729cc101cc230)），MIT。

它不适合整仓搬入：UI、下载器、SQLite manifest 和笔记生成编排是一套独立产品，且生成流程耦合外部 Agent CLI。应复用它的**分层、逐视频可恢复和 note contract**，不复用整套应用。

### 2. `mcp-video-analyzer`：首选实际理解组件

- 支持本地视频绝对路径、TikTok/YouTube/Instagram 等 URL。[输入支持](https://github.com/guimatheus92/mcp-video-analyzer#tools)
- 语音优先使用平台字幕，无字幕时 Whisper；画面做场景关键帧，静态 talking-head 短视频会均匀采样兜底；再做 OCR 并和转写合并成 annotated timeline。[`analyze_video`](https://github.com/guimatheus92/mcp-video-analyzer#analyze_video--full-video-analysis)
- CLI stdout 是单个 JSON 文档，便于当前 Node 项目通过子进程和文件边界接入；Node 要求 `>=22.12.0`，与本项目 `>=22.19.0` 兼容。[package.json](https://github.com/guimatheus92/mcp-video-analyzer/blob/main/package.json)
- 最近提交为 2026-08-19（[`61dfc17`](https://github.com/guimatheus92/mcp-video-analyzer/commit/61dfc177ab7a13444dc94161b6874de98b4ac56f)），MIT。

它不会替本站决定“哪个项目值得关注”，也不会可靠地把一个口头项目名解析成唯一 GitHub 仓库。正确边界是输出证据，再交给本站自己的结构化抽取和核验层。

### 3. PENgram：实体与关系层

- 本地音视频经 faster-whisper 转写后，以 LLM 抽取实体与主题，再为关系赋 24 种语义类型。[架构](https://github.com/penfieldlabs/pengram#how-it-works)
- 每条边带 `EXTRACTED`、`INFERRED` 或 `AMBIGUOUS` 置信标签，这种区分很适合本站避免把模型推测当作视频明说的事实。[关系词表](https://github.com/penfieldlabs/pengram#relationship-vocabulary)
- 输出 `graph.json`、交互图、报告和知识库 vault，处理结果按内容哈希缓存，可恢复。[输出与健康状态](https://github.com/penfieldlabs/pengram#output-formats)
- 最近提交为 2026-05-04（[`f672828`](https://github.com/penfieldlabs/pengram/commit/f672828757c565736685e1b058c1dbbd649b956e)），MIT。

局限是音视频路径主要依赖转写，并不会像 `mcp-video-analyzer` 那样把一条视频的关键帧与 OCR 统一对齐；它也输出通用知识图谱，而不是本站需要的项目候选数组。因此更适合借鉴或作为后处理器，不应单独承担视频理解。

## 轻量替代与参考项目

| 项目 | 能力 | 维护/许可 | 结论 |
|---|---|---|---|
| [`yanlingLabs/video-extract-mcp`](https://github.com/yanlingLabs/video-extract-mcp) | 本地 Whisper/SenseVoice、关键帧选择、OCR 新颖度、manifest/transcript/frame paths；有 MCP、CLI 和 TypeScript library | 最近提交 2026-08-21（[`628ae41`](https://github.com/yanlingLabs/video-extract-mcp/commit/628ae412d8016531d5928bdd96b76fbdb8e6c070)）；[MIT](https://github.com/yanlingLabs/video-extract-mcp/blob/main/LICENSE) | 更本地化、接近 TS 栈的第二选择；仍需语义抽取层 |
| [`dagonet/OmniScribe`](https://github.com/dagonet/OmniScribe) | faster-whisper + RapidOCR，把 `[SPEECH]`、`[ON-SCREEN]`、`[BOTH]` 合并为带时间戳 JSON/Markdown | 最近提交 2026-07-16（[`a2c6b53`](https://github.com/dagonet/OmniScribe/commit/a2c6b5300d6d72baaa1b930b951066ab06ca90d3)）；[MIT](https://github.com/dagonet/OmniScribe/blob/main/LICENSE) | 轻量统一 transcript 很好；没有关键帧视觉语义和项目实体层 |
| [`WebDevBar/watch-video`](https://github.com/WebDevBar/watch-video) | 本地转写、关键帧、OCR，输出 `SUMMARY.md`、timeline、transcript 和 frames，面向 Codex/Claude | 以仓库当前 LICENSE 为准 | 适合作为“视频 → Agent 可读上下文”的轻量替代，不是知识库或项目抽取器 |
| [`hwanyong/analysis-video`](https://github.com/hwanyong/analysis-video) | 按屏幕变化抽帧，把关键画面、时间段和对应语音合并成一个 `context.md` | 最近提交 2026-08-22（[`8e5c1e2`](https://github.com/hwanyong/analysis-video/commit/8e5c1e298b685609444f913b89943d749a59c4a1)）；[MIT](https://github.com/hwanyong/analysis-video/blob/main/LICENSE) | 适合讲座、录屏、幻灯片；不是实体核验器 |
| [`HKUDS/VideoRAG`](https://github.com/HKUDS/VideoRAG) | Whisper、视频切片、视觉表征、跨视频知识图谱与问答 | 最近提交 2026-03-18；当前实现因 ImageBind 受非商业许可限制，[双许可证](https://github.com/HKUDS/VideoRAG/blob/main/LICENSE) | 面向数十/数百小时跨视频问答，需约 24GB GPU；对逐条短视频策展过重 |

另外两个项目功能上值得参考，但当前不应直接集成：

- [`mdc159/youtube-transcripts`](https://github.com/mdc159/youtube-transcripts)（`yt-distill`）能从描述、评论、转写和 OCR 中收集 URL，分类为 `github_repo | docs | asset_download | other`，固定仓库 commit SHA，并输出逐条 citation；这是最贴近“找出项目和链接”的设计。[链接追踪](https://github.com/mdc159/youtube-transcripts#lesson-liberation-skill-packages)；[产物结构](https://github.com/mdc159/youtube-transcripts#output) 但仓库根目录当前没有 LICENSE，`pyproject.toml` 也未声明许可证，因此只能作为验收与 schema 参考。
- `0xchamin/mcptube` 有较完整的实体/wiki 方向，但当前没有 LICENSE；同样不能把公开源码等同于获得复用授权。

## 与本站现有模型的对应关系

本站实际有“每日关注”“开源关注”和“问一问/公开资料问答”。公开资料问答不是新的内容来源，而是由已经发布的每日关注与公开仓库资料派生的检索面；领域定义明确禁止它访问未发布私有资料。[领域边界](../../CONTEXT.md#公开资料问答)

因此视频不能整体直接塞进“问一问”，而要先拆成审核候选：

| 解析结果 | 去向 | 说明 |
|---|---|---|
| 能唯一核验官方 GitHub URL 的仓库 | “开源关注”待审核候选 | 仍需补齐仓库事实、证据、个人研判、场景、风险和状态。[现有类型](../../lib/open-source-types.ts) |
| 产品、论文、商业工具或找不到唯一仓库的名称 | 通用关注/待整理队列 | 不能强塞进只面向 GitHub 仓库的模型 |
| 视频中的方法、结论、经验和观点 | “每日关注”式策展候选 | 现有条目形态包含 `title`、`summary`、`analysis`、`tags`、`links` 和来源。[现有类型](../../lib/curation-types.ts) |
| 已人工批准并发布的上述条目 | “问一问”检索索引 | 问答只消费公开投影，不直接消费收藏视频、转写或私有解析结果 |

一个视频可能提到多个项目，也可能没有可发布项目，因此输出基数必须是“一视频 → 0..N 个项目候选 + 0..N 个知识候选”。

## 建议的抽取 contract

```json
{
  "sourceVideo": {
    "awemeId": "...",
    "sourceUrl": "...",
    "author": "...",
    "description": "..."
  },
  "mentionedProjects": [
    {
      "nameAsMentioned": "...",
      "kind": "github_repo | product | paper | tool | unknown",
      "description": "视频如何介绍它",
      "whyItMatters": "为什么值得进入关注队列",
      "claimedUrl": null,
      "canonicalGithubUrl": null,
      "evidence": [
        { "timestamp": 18.4, "channel": "transcript | ocr | frame | description", "text": "..." }
      ],
      "verification": "verified | ambiguous | unresolved",
      "target": "open_source | daily_focus | review_queue"
    }
  ],
  "insights": [
    {
      "title": "...",
      "summary": "...",
      "analysis": "...",
      "tags": ["..."],
      "evidence": [{ "timestamp": 31.2, "text": "..." }]
    }
  ]
}
```

每个项目名都只能先作为候选。若视频只说了近似名称，或 OCR 只读到残缺 URL，必须保持 `ambiguous/unresolved`；不能直接采用 GitHub 搜索结果第一项。`canonicalGithubUrl` 应由独立核验步骤写入，而不是和多模态抽取在同一次模型调用中猜出。

## 输入层候选

| 工具 | 收藏能力 | 许可证与现状 | 新方案中的位置 |
|---|---|---|---|
| [`jiji262/douyin-downloader`](https://github.com/jiji262/douyin-downloader) | 默认收藏、自定义收藏夹、收藏合集；视频/图集/原声/JSON/评论和可选音频转写 | [MIT](https://github.com/jiji262/douyin-downloader/blob/main/LICENSE)，近期活跃 | **首选收藏输入 sidecar**，不承担内容理解 |
| [`Johnserf-Seed/f2`](https://github.com/Johnserf-Seed/f2) | 收藏作品与收藏夹作品分别有异步 API | [Apache-2.0](https://github.com/Johnserf-Seed/f2/blob/main/LICENSE) | 需要完全掌控抓取模型时替换输入层 |
| [`JoeanAmier/TikTokDownloader`](https://github.com/JoeanAmier/TikTokDownloader) | 当前账号收藏与交互式收藏夹 | [GPL-3.0](https://github.com/JoeanAmier/TikTokDownloader/blob/master/license)；README 明示加密参数失效且不再维护 | 不作为新接入首选 |

收藏输入只能在本机低频、人工触发运行。公开抖音开放平台没有证明普通开发者可读取个人收藏视频列表；这些工具依赖 Cookie 和网页接口，存在接口失效、验证码、账号限制和平台条款风险。[官方视频数据能力](https://developer.open-douyin.com/capacity-center-page/capacity-detail/7180522194714230845)；[OpenAPI 列表](https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/list)

Cookie、收藏列表、原始视频、转写、关键帧和未核验实体都应进入 `data/sensitive/` 同级的私有原始层，不得进 Git、浏览器、Vercel 或 Supabase public projection。[本站敏感数据规范](../sensitive-data.md)

## 最终推荐

- **参考架构：** `social-knowledge-base`。借它的逐视频可恢复编排、实体 frontmatter、摘要/要点/OCR/原话证据和跨视频索引设计。
- **实际理解层：** `mcp-video-analyzer` CLI JSON。它与当前 Node 版本兼容，输入本地 MP4 最稳定，也已有被短视频知识库实际组合使用的证据。
- **实体层：** 首版直接实现自有 `mentionedProjects[]` contract；可借 PENgram 的 `EXTRACTED/INFERRED/AMBIGUOUS` 思路。只有后续确实需要跨视频实体图谱时，才引入 PENgram 运行时。
- **核验层：** 独立查询 GitHub 官方仓库，核验名称、所有者、描述和链接；无法唯一确定的保留待整理。
- **发布层：** GitHub 项目进入“开源关注”审核，观点进入“每日关注”式审核；两者发布后才更新“问一问”索引。

本轮只完成 GitHub 调研，不改应用代码。若进入验证，先从一个收藏夹取 5 条不同类型视频（口播、录屏、字幕卡、快速切镜、含英文项目名各一条），验收项目名/OCR/时间戳证据、多项目拆分和 `unresolved` 行为，再决定是否正式接入。
