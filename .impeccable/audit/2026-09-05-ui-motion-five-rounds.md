# Web UI 与动效审计：五轮优化

日期：2026-09-05。目标：审计现有 Web，全程最多五轮修复与验证，保留黑白灰、身份轨、连续内容流和首访仪式。此前删除的原生应用不在范围内。

## 实现一致性结论

通过：站点有明确的个人档案视觉体系。Impeccable 文件检测仅返回 1 项提示：`app/opengraph-image.tsx:18` 使用未登记的 Noto Sans SC。核实这是服务端分享图片的中文内嵌字体，不是页面字体漂移，不作 UI 缺陷修复。没有改写产品事实或替换视觉风格。

## 健康度

分数为本次抽样审计判断，不等于 WCAG 认证或真实设备性能评分。

| 维度 | 初查 | 修复后 | 依据 |
|---|---:|---:|---|
| 无障碍 | 2 | 3 | 修复持续动效暂停、GIF 首帧、弹窗键盘循环；未做完整读屏人工测试 |
| 性能 | 3 | 3 | 临时动画有清理，图片按需加载；未采集真机帧率或生产 Web Vitals |
| 响应式 | 3 | 3 | 320/390px 抽样无整页溢出，保留横向样张带；真机键盘待验证 |
| 主题 | 3 | 4 | 修复问答暗色空状态对比度；深浅稳定态复查通过 |
| 实现一致性 | 3 | 4 | 五轮针对明确交互缺陷，复用现有组件与样式语言 |
| 合计 | 14/20 | 17/20 | Good |

## 发现与执行记录

共 6 个可确认问题：P0 0、P1 3、P2 3、P3 0；本次全部修复。

| 轮次 | 问题与影响 | 位置 | 修复与验证 |
|---|---|---|---|
| 1 | P2：SSR 未知动态偏好被当作允许，GIF 可在水合前自动播放并抢先下载 | components/x-video-player.tsx | SSR 保持海报和 preload=none，挂载且明确允许动态效果后启用；减少动态效果时暂停 GIF。4 项测试通过，含 SSR 回归。对应 harden。 |
| 2 | P1：弹窗初始焦点在容器，Shift+Tab 未覆盖这个状态，可能离开对话框；仅锁 body 与根滚动不一致 | components/about-print.tsx | 初始反向 Tab 定位最后控件，过滤 disabled，锁 html 并恢复原值。Ego 真键盘验证焦点在关闭按钮，Escape 后恢复到触发器，overflow 恢复。对应 harden，WCAG 2.4.3。 |
| 3 | P2：样张带拦截 Ctrl+wheel，影响捏合/缩放；非像素滚轮单位未换算 | components/works-shot-strip.tsx | 放行 Ctrl/Meta/Shift 修饰手势，换算行/页单位，边缘交还页面。2 项测试通过，含缩放与边缘行为。对应 adapt。 |
| 4 | P2：移除移动导航 ghost 时没有停止仍在运行的漂移动画 | components/profile-transition-state.ts | 替换及清除时先停止动画再移除节点。2 项测试通过，覆盖重复开始和清理，保留原有先读布局再写 DOM。对应 optimize。 |
| 5 | P1：六条背景词轨持续超过 5 秒，无用户暂停入口 | components/dot-field-parallax.tsx、components/interactive-dot-field.tsx、app/globals.css | 添加 44px 键盘按钮、aria-pressed；暂停后六条均 paused，恢复后均 running；减少动态效果时轨道 animation=none，隐藏无用按钮。对应 animate/harden，WCAG 2.2.2。 |
| 5 验证修正 | P1：问答暗色空状态说明文字 3.05:1，低于 4.5:1 | components/ask-chat.module.css | 补齐说明元素的暗色规则，从 #656568 改为现有 #999。暗色和浅色稳定态 axe 无违规。对应 polish，WCAG 1.4.3。 |

## 验证范围与证据

- 桌面 1512px：真实页面观察与暂停/恢复操作。移动 320px、390px：首页、设计收藏、构建详情、问答均 scrollWidth=innerWidth。
- axe WCAG A/AA 自动扫描：首页、每日动态、每日关注、设计收藏、抖音收藏、开源关注、构建、问答；暗色扫描发现的问答说明对比度已修复并复查。浅色问答切换动画中瞬时报告不计为稳定态缺陷，过渡完成后复查为零。
- CDP 收集本轮浏览器异常与 console error：无。
- Impeccable detector：1 项已核实的分享图片字体提示；无其他返回项。
- pnpm typecheck、pnpm lint、pnpm test 通过；29 个 Vitest 文件、102 个测试，加 81 个 Node 测试。生产构建通过。

## 保留的优点与边界

身份轨和内容流一致、加载与恢复状态明确、背景动效已在不可见和后台时暂停、移动布局复用 Web 路由、原有 reduced-motion 静态词条布局保留。首访仪式和小票打印保留其设计意图。

尚未做真机 Safari/Android 键盘、完整读屏人工检查、CPU 降速帧率和生产用户性能测量，不据此声称全面无障碍合规或帧率提升。后续若继续：优先用 optimize 做真实设备性能测量，再用 polish 收尾。本次五轮已结束，不再扩展第六轮。
