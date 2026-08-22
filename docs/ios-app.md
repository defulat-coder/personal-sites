# iOS App（ios/）

原生 SwiftUI 客户端，复刻 Web 端五个模块：每日动态、推特点赞、开源关注、作品档案、问一问。

## 技术栈

- Swift 6 + SwiftUI，iOS 17.0+，`@Observable` + `NavigationStack`
- 依赖（SwiftPM）：`supabase-swift` v2。Markdown 渲染用系统 `AttributedString(markdown:)`，无额外依赖
- Xcode 工程用 synchronized folders（objectVersion 77），新增 Swift 文件无需改 `project.pbxproj`

## 构建与测试

```bash
cd ios
cp Secrets.xcconfig.example Secrets.xcconfig   # 填入真实值（已被 gitignore）
xcodebuild -scheme PersonalSite -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
xcodebuild -scheme PersonalSite -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
```

## 配置（Secrets.xcconfig → Info.plist → `Config.swift`）

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | 直连三张公开投影（publishable key，RLS `using(true)`） |
| `SITE_BASE_URL` | 站点 API 出口；本地开发 `http://127.0.0.1:3000`（已放行 `NSAllowsLocalNetworking`） |

密钥纪律与 Web 端一致：App 只持 publishable key；service-role、`KIMI_API_KEY`、`ASK_SESSION_SECRET` 等绝不进 xcconfig。

## 数据接入（混合）

| 模块 | 来源 |
| --- | --- |
| 每日动态 | Supabase `ai_news_public_items` 直连 |
| 作品档案 | Supabase `project_public_snapshots` 直连 |
| 开源关注 | Supabase `github_open_source_items` 直连；仓库树/文件走站点 `/api/open-source/[slug]/repository/*` |
| 推特点赞 | 站点 `/api/curation` + `/api/curation/[id]`（策展在本地 sqlite，不在 Supabase）；视频经 `/api/x-media` 代理用 `AVPlayer` 播放 |
| 问一问 | 站点 `POST /api/ask`（SSE：`sources`/`text`/`done`/`error`）；`visitorId` 用 `identifierForVendor` 去连字符，限流按 IP 无需客户端处理 |

数据契约以 `lib/*-types.ts` 为准；Supabase 行外层 snake_case 列名用显式 `CodingKeys`，`content`/`snapshot` jsonb 内部是 camelCase，解码策略分层，见 `ios/PersonalSiteTests/ModelDecodingTests.swift`。

## 结构

- `PersonalSite/Core/` — `Config`、`SupabaseClientProvider`、`SiteAPIClient`（含 429 `Retry-After`）、`SSEStream`（通用 SSE 解析 + 问一问业务事件映射）
- `PersonalSite/Models/` — Codable 模型，逐字段对齐 TS 类型；北京时间分组/相对时间在 `AiNews.swift`
- `PersonalSite/Features/` — 五个模块各一个目录；`Support/LoadStateView.swift` 提供加载/空态/错误重试壳与 `MarkdownText`
- `PersonalSiteTests/` — Swift Testing；分组、SSE 解析、模型解码共 20 例

## 已知边界

- Markdown 仅行内级渲染（`inlineOnlyPreservingWhitespace`），长文可读但不渲染块级样式
- 无登录、无推送、无客户端缓存；仓库浏览每层重新拉整棵树（服务端 `s-maxage=600`）
- 未做 App Store 签名与上架
