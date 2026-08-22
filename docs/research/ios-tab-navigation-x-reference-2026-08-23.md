# iOS 底部导航与 SF Symbols 参考（2026-08-23）

## 研究范围

本说明用于回答当前 iOS App 五个顶级入口（首页、动态、关注、构建、问一问）的底部导航应该如何处理。规范结论以 Apple HIG、Apple Developer Documentation 与 WWDC 为准；X 原帖只作为设计社区和真实产品采用方式的旁证，不把个人帖子当作平台规范。

## 结论先行

1. **恢复图标，并保留文字。** 五个顶级入口仍适合原生 Tab Bar，但已接近紧凑上限；标签必须保持单个短词。纯文字虽然能渲染，却不是 Apple 为 iPhone Tab Bar 推荐和展示的标准形态。
2. **不要手工把图标压成 13pt Light，也不要禁止选中态填充。** 给系统传入 SF Symbol 的基础轮廓名，由 Tab Bar 自动决定尺寸、字重、光学对齐和选中态的填充变体。
3. **不尝试固定缩小原生外壳。** Apple 没有公开可调 Tab Bar 整体高度的 SwiftUI API。iOS 26 的轻量方式是保留系统悬浮 Liquid Glass，并在 iPhone 上使用 `.tabBarMinimizeBehavior(.onScrollDown)`。
4. **本项目推荐一组简单、视觉面积接近的图标：** `house`、`clock`、`bookmark`、`cube`、`bubble.left`。标签已经表达完整语义，图标只负责快速定位，不需要把每个概念画得过于具体。

## 1. 五项导航是否应该保留图标

Apple 将 Tab Bar 定义为 App 顶级区域之间的持久导航。HIG 要求给每个 Tab 提供简短标签，并建议使用熟悉、可缩放且能适配紧凑/常规环境的 SF Symbols；iPhone 紧凑布局的官方示意也是“图标在上、文字在下”。Apple 还明确偏好 Tab Bar 中使用填充符号，以保持平台一致性。[Apple HIG：Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)

因此，对本项目更稳妥的判断是：

- 五个 Tab 可以保留，不需要继续合并；
- 保留“图标 + 文字”，不要采用纯文字版本；
- 文字继续使用“首页 / 动态 / 关注 / 构建 / 问一问”，不添加第二行或解释性文案；
- “问一问”虽然是动作，但它对应一个可持续停留、保留上下文的顶级页面，所以仍可以作为 Tab，而不是放成悬浮操作按钮。

X 上有两个有参考价值的原始案例：

- iOS 设计师 Mike Rundle 提醒设计者直接使用 Apple 的 SF Symbols 资源，而不是忽略系统已经提供的大量经过光学校准的符号。[Mike Rundle 的 X 原帖](https://x.com/flyosity/status/1757259577597301236)
- Simon Grimm 展示 iOS 26 原生 Native Tabs 时，强调的价值是原生转场和自动获得 Liquid Glass，而不是自定义一套外壳。[Simon Grimm 的 X 原帖](https://x.com/schlimmson/status/1965081715233484998)

这两个帖子不是规范，但与 Apple 官方方向一致：**可以借鉴的是“系统原生结构 + 平台符号”，不是截图里的某个固定像素值。**

## 2. 图标尺寸、线宽与选中态

### 应该做

- 给 `Label` 或 `Tab` 传入基础轮廓名，例如 `house`，而不是手动传 `house.fill`。
- 让 Tab Bar 环境自动为选中项选择合适的填充变体。Apple 的 SwiftUI Tab 导航示例明确使用基础符号名，并由系统处理状态。[Apple：Enhancing your app’s content with tab navigation](https://developer.apple.com/documentation/swiftui/enhancing-your-app-content-with-tab-navigation)
- 使用单色 `tint`，让未选中项采用系统次级颜色；不要为五个 Tab 分别着色。
- 在 SF Symbols App 的 Tab Bar 预览环境中比较候选图标的视觉面积，而不是只比较路径边界或字符串名称。
- 保持图标语义简单、常见。文字已经消除歧义，不需要用复杂的多元素 Symbol 复述标签。

### 不应该做

- 不要对 Tab 图标设置 `.font(.system(size: 13, weight: .light))`；这会让图标与原生文字和外壳失去系统的光学匹配。
- 不要通过 `.symbolVariant(.none)` 一类处理阻止系统生成选中填充态。
- 不要同时自定义字号、线宽和 frame 来“缩小”系统 Tab Bar；这只会缩小内容，外壳和触控区域不会跟着变小，结果就是之前出现的“图标很小、导航仍然很大”。
- 不要用五个轮廓复杂度差异很大的图标，例如把简单 `house` 与线条密集的 `wrench.and.screwdriver` 放在同一组。

SF Symbols 的权重会与 San Francisco 字体权重精确匹配，symbol scale 则用于改变相对强调而不破坏这种匹配；在 Tab Bar 中系统已经掌握布局上下文，通常无需手工干预。[Apple HIG：SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols)

## 3. iOS 26 Liquid Glass 与原生外壳限制

iOS 26 中，标准 `TabView` 在 iPhone 上自动采用浮于内容之上的 Liquid Glass Tab Bar。Apple 将它视为结构组件升级，并建议升级后先审查页面、移除多余自定义背景，而不是在系统 Tab Bar 外再绘制一层玻璃。[WWDC25：Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/)

需要明确的限制：

- SwiftUI 没有公开 API 可以固定调小原生 Tab Bar 的整体高度或胶囊外壳 frame；公开定制面主要是 Tab 内容、可见性、角色、底部附件和滚动最小化。这是依据当前公开 API 范围作出的结论。
- `.tabBarMinimizeBehavior` 的滚动最小化只支持 iPhone。[Apple：TabBarMinimizeBehavior](https://developer.apple.com/documentation/swiftui/tabbarminimizebehavior)
- 普通从上向下阅读的列表应使用 `.onScrollDown`：向下阅读时缩小，反向滚动时恢复。Apple 在 SwiftUI 和 UIKit 的 iOS 26 示例中都采用这一模式。[WWDC25 SwiftUI 示例（5:07）](https://developer.apple.com/videos/play/wwdc2025/323/?time=307)；[WWDC25 UIKit：Build a UIKit app with the new design](https://developer.apple.com/videos/play/wwdc2025/284/)
- `.automatic` 不应被当成“必然会缩小”；若产品意图明确，应显式设置 `.onScrollDown`。
- 首页内容没有持续纵向滚动时，Tab Bar 保持展开是正常的系统行为。不要为了让首页外壳更小而伪造滚动或覆盖安全区。

## 4. 本项目的具体 SF Symbols 推荐

| 页面 | 基础 Symbol | 系统选中态 | 选择理由 |
|---|---|---|---|
| 首页 | `house` | `house.fill` | 最熟悉的顶级入口，轮廓简单，识别速度快 |
| 动态 | `clock` | `clock.fill` | 页面按时间追踪每日变化，语义比 `newspaper` 更准确，视觉也更轻 |
| 关注 | `bookmark` | `bookmark.fill` | 同时涵盖收藏推荐与持续跟踪，避免用 `heart` 把语义收窄为点赞 |
| 构建 | `cube` | `cube.fill` | 表达已构建的工程/产物，比 `shippingbox` 更简洁，比工具组合图标更轻 |
| 问一问 | `bubble.left` | `bubble.left.fill` | 文字标签已经说明“提问”，单气泡比 `questionmark.bubble` 更干净、视觉面积更稳定 |

这组图标的共同点是：轮廓单一、没有复杂的附加标记，选中后也不会出现某一项突然比其他项重很多。若实机测试认为 `cube.fill` 仍偏重，构建页的第一替代是 `hammer`，但应先用 SF Symbols App 的 Tab Bar 预览比较，不凭截图决定。

## 5. 推荐落地方式

在当前原生 `TabView` 基础上恢复 `Label`，不加任何图标字号、字重、frame 或 symbol variant 覆盖：

```swift
.tabItem {
    Label(tab.label, systemImage: tab.systemImage)
}
```

`AppTab.systemImage` 使用上表的五个基础轮廓名。继续保留：

```swift
.tint(Color.psInk)

if #available(iOS 26.0, *) {
    content.tabBarMinimizeBehavior(.onScrollDown)
}
```

验收时需要看三个状态，而不是只看一张首页截图：

1. 默认展开态：五项图标与文字是否清楚、光学重量是否接近；
2. 分别选中五项：系统 fill 是否有明确但不过重的状态差；
3. 内容页向下滚动：原生 Tab Bar 是否自然缩小，反向滚动是否恢复。

## 最终推荐

可以“抄”的方案不是某个 X 概念稿，而是 Apple 自己的原生组合：**五个短标签 + 五个基础 SF Symbols + 系统自动填充选中态 + iOS 26 原生 Liquid Glass + 向下滚动最小化**。这同时解决了纯文字版本缺乏视觉锚点、13pt Light 版本图标过小，以及试图缩小外壳却无法改变系统触控结构的三个问题。
