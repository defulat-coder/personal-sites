import SwiftUI
import WebKit

/// 可选的首次欢迎动画：主页已在下层完成渲染，用户可随时跳过。
/// 电池五格节拍 [0.45,1.4,2.35,3.3,4.25]s，颜色沿 4.7s 主线红→黄→绿；
/// 4.48s 电池 1→1.08→1 回弹；5s 后以应用统一的 200ms 透明度转场退出。
/// 角色是 SMIL 逐帧 SVG（100 帧 / 50ms），SwiftUI 不能直接渲染，用 WKWebView 加载以保真。
struct WelcomeAnimationView: View {
    var onFinished: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    /// 充电时间线起点：SVG 加载完成（Web 端也是 <img> onLoad 才开始），1.2s 兜底。
    @State private var startDate: Date?
    @State private var didFinish = false

    fileprivate static let cellDelays: [Double] = [0.45, 1.4, 2.35, 3.3, 4.25]
    fileprivate static let colorDuration = 4.7
    private static let bounceStart = 4.48
    private static let bounceDuration = 0.42
    private static let revealAt = 5.0

    var body: some View {
        ZStack(alignment: .topTrailing) {
            TimelineView(.animation(paused: startDate == nil || didFinish || reduceMotion)) { context in
                let elapsed = startDate.map { context.date.timeIntervalSince($0) } ?? 0
                content(elapsed: elapsed)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            Button("跳过", action: finish)
                .font(.callout.weight(.medium))
                .foregroundStyle(Color.psInk)
                .padding(.horizontal, 16)
                .frame(minWidth: 44, minHeight: 44)
                .buttonStyle(PSPressButtonStyle())
                .padding(.top, 8)
                .padding(.trailing, 8)
                .accessibilityHint("关闭首次欢迎动画并进入首页")
        }
        .task(id: reduceMotion) {
            if reduceMotion {
                startDate = Date().addingTimeInterval(-Self.revealAt)
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                finish()
            } else {
                // 与 Web 一致：SVG 未就绪时 1.2s 兜底开播。
                try? await Task.sleep(for: .milliseconds(1200))
                guard !Task.isCancelled else { return }
                if startDate == nil { start() }
            }
        }
    }

    private func content(elapsed: Double) -> some View {
        ZStack {
            (colorScheme == .dark ? Color.psSurface : Color.white).ignoresSafeArea()
            // 电池绝对定位在角色图顶部（Web: top: calc(3% - 2px)，横向居中，与图重叠）。
            let characterHeight = 132 * 685.0 / 700.0
            VStack(spacing: 0) {
                Spacer()
                ZStack(alignment: .top) {
                    LoaderCharacterView(onLoaded: start)
                        .frame(width: 132, height: characterHeight)
                    BatteryView(elapsed: elapsed)
                        .frame(width: 52, height: 18)
                        .scaleEffect(Self.batteryScale(at: elapsed))
                        .offset(y: characterHeight * 0.03 - 2)
                }
                Spacer()
            }
            // 与 Web 一致：SVG 就绪前整组视觉不可见。
            .opacity(startDate == nil ? 0 : 1)
        }
        .onChange(of: elapsed >= Self.revealAt) { _, done in
            if done, !didFinish { finish() }
        }
    }

    private func start() {
        guard startDate == nil else { return }
        startDate = Date()
    }

    private func finish() {
        guard !didFinish else { return }
        didFinish = true
        onFinished()
    }

    /// 回弹签名：4.48s 起 1→1.08→1，0.42s，ease [0.34,1.56,0.64,1]，关键帧 [0,0.55,1]（逐段局部时间）。
    private static func batteryScale(at elapsed: Double) -> CGFloat {
        guard elapsed >= bounceStart else { return 1 }
        let t = min((elapsed - bounceStart) / bounceDuration, 1)
        let easing = cubicBezier(0.34, 1.56, 0.64, 1)
        let scale = t <= 0.55
            ? 1 + 0.08 * easing.evaluate(x: t / 0.55)
            : 1.08 - 0.08 * easing.evaluate(x: (t - 0.55) / 0.45)
        return CGFloat(scale)
    }
}

/// 电池：外框 + 5 格 + 正极头，尺寸按 globals.css 的 rem 值换算（1rem = 16pt）。
private struct BatteryView: View {
    let elapsed: Double

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 2) {
                ForEach(0..<5, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(cellColor())
                        .scaleEffect(y: isLit(index) ? 1 : 0.55)
                        .opacity(isLit(index) ? 1 : 0)
                }
            }
            .padding(2.5)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: 5)
                    .stroke(Color.psBatteryStroke, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 5))
            UnevenRoundedRectangle(cornerRadii: RectangleCornerRadii(bottomTrailing: 2, topTrailing: 2))
                .fill(Color.psBatteryStroke)
                .frame(width: 3, height: 7)
        }
    }

    private func isLit(_ index: Int) -> Bool {
        elapsed >= WelcomeAnimationView.cellDelays[index]
    }

    /// 颜色沿全局 4.7s 主线插值：红(0) → 红(0.18) → 黄(0.52) → 绿(1)。
    private func cellColor() -> Color {
        let t = min(max(elapsed / WelcomeAnimationView.colorDuration, 0), 1)
        switch t {
        case ..<0.18: return .psBatteryRed
        case ..<0.52: return lerp(Color.psBatteryRed, Color.psBatteryYellow, (t - 0.18) / 0.34)
        default: return lerp(Color.psBatteryYellow, Color.psBatteryGreen, (t - 0.52) / 0.48)
        }
    }

    /// iOS 17 没有 Color.mix，用 UIColor 做 RGB 线性插值。
    private func lerp(_ from: Color, _ to: Color, _ fraction: Double) -> Color {
        var r1: CGFloat = 0, g1: CGFloat = 0, b1: CGFloat = 0, a1: CGFloat = 0
        var r2: CGFloat = 0, g2: CGFloat = 0, b2: CGFloat = 0, a2: CGFloat = 0
        UIColor(from).getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        UIColor(to).getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        let f = CGFloat(fraction)
        return Color(uiColor: UIColor(red: r1 + (r2 - r1) * f, green: g1 + (g2 - g1) * f, blue: b1 + (b2 - b1) * f, alpha: 1))
    }
}

/// 角色插画：WKWebView 加载 bundle 内的 SMIL 逐帧 SVG，透明背景、禁滚动禁交互。
private struct LoaderCharacterView: UIViewRepresentable {
    var onLoaded: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onLoaded: onLoaded) }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.isUserInteractionEnabled = false
        webView.navigationDelegate = context.coordinator
        if let url = Bundle.main.url(forResource: "ample-loader-sequence", withExtension: "svg") {
            let html = """
            <!doctype html><html><head><meta name="viewport" content="initial-scale=1">
            <style>html,body{margin:0;background:transparent}img{display:block;width:100%;height:100%}</style>
            </head><body><img src="\(url.lastPathComponent)" alt=""></body></html>
            """
            webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let onLoaded: () -> Void
        init(onLoaded: @escaping () -> Void) { self.onLoaded = onLoaded }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { onLoaded() }
    }
}

/// 三次贝塞尔缓动求值（牛顿迭代 + 二分兜底），用于复刻 Web 的 cubic-bezier 签名。
struct CubicBezierEasing: Sendable {
    let x1, y1, x2, y2: Double

    /// 输入时间 x ∈ [0,1]，输出进度 y。
    func evaluate(x: Double) -> Double {
        guard x > 0, x < 1 else { return x }
        var t = x
        for _ in 0..<8 {
            let cx = Self.sample(x1, x2, t) - x
            if abs(cx) < 1e-6 { return Self.sample(y1, y2, t) }
            let dx = Self.sampleDerivative(x1, x2, t)
            if abs(dx) < 1e-6 { break }
            t -= cx / dx
        }
        var lo = 0.0, hi = 1.0
        t = min(max(t, lo), hi)
        while lo < hi {
            let cx = Self.sample(x1, x2, t)
            if abs(cx - x) < 1e-6 { break }
            if cx < x { lo = t } else { hi = t }
            t = (lo + hi) / 2
        }
        return Self.sample(y1, y2, t)
    }

    private static func sample(_ a: Double, _ b: Double, _ t: Double) -> Double {
        // B(t) = 3a(1-t)²t + 3b(1-t)t² + t³
        3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t
    }

    private static func sampleDerivative(_ a: Double, _ b: Double, _ t: Double) -> Double {
        // B'(t) = 3a(1-t)(1-3t) + 3b·t(2-3t) + 3t²
        3 * a * (1 - t) * (1 - 3 * t) + 3 * b * t * (2 - 3 * t) + 3 * t * t
    }
}

private func cubicBezier(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double) -> CubicBezierEasing {
    CubicBezierEasing(x1: x1, y1: y1, x2: x2, y2: y2)
}
