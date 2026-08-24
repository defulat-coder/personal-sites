# 抖音收藏接入每日关注

抖音只作为关注来源。原始视频、转写、OCR 与模型草稿保存在本机敏感层；审核通过后才与 X 条目一起写入 `data/curation.sqlite`，并同步成为“问一问”的公开检索资料。

## 准备输入

使用 [`jiji262/douyin-downloader`](https://github.com/jiji262/douyin-downloader) 下载当前账号收藏。配置至少开启视频下载；建议同时开启 JSON 和 SQLite 去重。Cookie 只保存在本机，不进入本仓库。

输出目录根部应包含 `download_manifest.jsonl`。每条视频的 `file_paths` 必须能定位到本地视频文件。

## 视频转写

项目固定调用 `mcp-video-analyzer@0.10.0`。它会优先复用视频旁的 `.vtt`/`.srt`，否则按以下顺序寻找转写能力：

1. `WHISPER_HF_MODEL` 指定的本地 JS 模型；
2. `whisper` CLI（`pip install -U openai-whisper`）；
3. `OPENAI_API_KEY` 对应的转写接口。

中文视频建议使用本地 Whisper `small` 或 `medium`：

```bash
export WHISPER_MODEL=small
```

## 同步与审核

先用 5 条验证：

```bash
pnpm douyin:curation -- sync \
  --manifest /绝对路径/Downloaded/download_manifest.jsonl \
  --limit 5
```

默认使用本机 Codex CLI 的 `gpt-5.6-terra`（`high`）生成待审草稿。也可显式切换到项目现有 Pi/Kimi：

```bash
pnpm douyin:curation -- sync \
  --manifest /绝对路径/Downloaded/download_manifest.jsonl \
  --limit 5 \
  --engine pi
```

查看待审条目：

```bash
pnpm douyin:curation -- list
```

确认私有队列中的标题、摘要、解析、证据摘录和实体候选无误后批准：

```bash
pnpm douyin:curation -- approve douyin:<aweme_id>
pnpm curation:publish
```

`sync` 可重复运行，已处理条目默认跳过；需要重新分析时加 `--force`。批准状态会在重新分析时保留。

## 全量发现与增量检查点

本机 sidecar 安装完成后，由 `scripts/douyin-favorites-discover.py` 通过已登录收藏页滚动建立私有索引。它不会输出标题、Cookie 或收藏正文，只输出数量统计，并生成：

- `favorite-index.json`：当前完整收藏索引与首次/最近发现时间；
- `pending-video-urls.json`：尚未出现在下载 manifest 中的视频；
- `config-incremental.yml`：只包含本次待下载视频的 sidecar 配置。

下载 manifest、分析 raw 目录和 review queue 分别充当下载、视频理解和策展阶段的检查点；任一阶段中断后都从尚未完成的条目继续。

完整的全量/增量入口是：

```bash
pnpm douyin:sync
```

它每次都会重新发现收藏页，只下载 manifest 中不存在的视频，再只解析 review queue 中尚未完成的条目。默认使用 `gpt-5.6-terra`（`high`）通过 Codex CLI 20 并发整理内容、本地 Whisper/OCR 6 并发提取证据；每个本地转写进程限制约 2 个 CPU 线程。可用 `--analyze-limit 20` 控制单次批量，或用 `--discover-only` 只刷新收藏索引。

## 数据位置

| 数据 | 路径 | 公开 |
| --- | --- | --- |
| 分析 JSON、关键帧与时间线 | `data/sensitive/douyin-curation/raw/` | 否 |
| 待审草稿与项目候选 | `data/sensitive/douyin-curation/review-queue.json` | 否 |
| 已批准的统一每日关注投影 | `data/curation.sqlite` | 是 |

实体候选只是辅助审核，不会自动写入“开源关注”；无法唯一核验的项目名继续保留在私有待审资料中。
