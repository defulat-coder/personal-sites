# Android App（android/）

原生 Kotlin + Jetpack Compose 客户端，功能与数据接入完整对齐 ios/ 的 iOS 实现：五个模块（每日动态、每日关注、开源关注、作品档案、问一问）+ 首页（Bio、职业时间线、信号场）。先读 [docs/ios-app.md](ios-app.md) 了解数据流与契约，本文只记差异。

## 技术栈

- Kotlin 2.4 + Jetpack Compose（BOM 2025.08 线），minSdk 26，compileSdk 36，AGP 8.13 + Gradle 8.14
- 依赖：supabase-kt v3（postgrest-kt，OkHttp engine）、OkHttp（站点 API / SSE）、kotlinx-serialization、Coil3（图片）、Media3 ExoPlayer（视频）、DataStore（主题/欢迎页状态）
- 2026 年起的新版 androidx 普遍要求 AGP 9.1 + SDK 37，本项目固定 2025 年稳定线，升级时整组评估

## 构建与测试

```bash
cd android
cp local.properties.example local.properties   # 填入真实值（已被 gitignore）
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools   # brew 的 android-commandlinetools
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

## 配置（local.properties → BuildConfig → `core/Config.kt`）

| 变量 | 用途 |
| --- | --- |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | 直连三张公开投影（publishable key，RLS `using(true)`） |
| `SITE_BASE_URL` | 站点 API 出口；模拟器本地开发用 `http://10.0.2.2:3000`（清单已放行 `usesCleartextTraffic`，对齐 iOS 的 `NSAllowsLocalNetworking`） |

密钥纪律与 iOS 一致：App 只持 publishable key；service-role、`KIMI_API_KEY`、`ASK_SESSION_SECRET` 等绝不进 local.properties。

## 数据接入（与 iOS 逐项一致）

| 模块 | 来源 |
| --- | --- |
| 每日动态 | Supabase `ai_news_public_items` 直连（同一 PostgREST 投影与分页策略） |
| 作品档案 | 站点 `/api/works`（服务端读取 `data/curation.sqlite`） |
| 开源关注 | 站点 `/api/open-source` + `/api/open-source/[slug]`；仓库树/文件走 `/api/open-source/[slug]/repository/*` |
| 每日关注 | 站点 `/api/curation` + `/api/curation/[id]`；X 视频经 `/api/x-media` 代理用 ExoPlayer 播放 |
| 问一问 | 站点 `POST /api/ask`（SSE：`sources`/`text`/`done`/`error`）；`visitorId` 优先 `ANDROID_ID`（16 位 hex，过服务端正则），否则 DataStore 持久化随机 UUID 去连字符；限流按 IP 无需客户端处理 |

数据契约以 `lib/*-types.ts` 为准；每日动态 Supabase 行与站点 SQLite API 都由原生模型测试验证。Markdown 仅行内级渲染（`renderInlineMarkdown`，对齐 iOS 的 `inlineOnlyPreservingWhitespace`）。

## 结构

- `core/` — `Config`、`SupabaseClientProvider`、`SiteApiClient`（含 429 `Retry-After`）、`SSEStream`（逐行 SSE 解析）、`Theme`（PSColors，对齐 globals.css light/dark）、`Motion`
- `models/` — `@Serializable` 模型，逐字段对齐 TS 类型；北京时间分组/相对时间在 `AiNews.kt`
- `features/` — 五个模块各一个目录 + `home/`（Bio 打字机、信号场弹幕、职业时间线）+ `support/`（LoadStateView 三态、ContentList 样式、页头、AboutPrint 小票、Welcome 动画）
- `src/test/` — JUnit4 单元测试：分组、SSE 解析、模型解码、信号场参数、动效行为，对齐 iOS 的 29 例

## 已知边界（对齐 iOS）

- Markdown 仅行内级渲染，长文可读但不渲染块级样式
- 无登录、无推送、无客户端缓存；仓库浏览每层重新拉整棵树（服务端 `s-maxage=600`）
- 未做应用商店签名与上架
- 模拟器验证：站点 dev server 需监听局域网（`next dev --hostname 0.0.0.0`）或用 10.0.2.2 回环宿主机
