import SwiftUI

/// 信号场：点阵背景 + 词条弹幕，对齐 components/interactive-dot-field.tsx。
/// 词条从右向左匀速划过六条水平泳道，参数全部由 SignalFieldTerms 的索引纯函数给出。
/// 深色模式对齐 Web 的 filter:invert(1)——内部固定浅色绘制，整体反色。
struct SignalFieldView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @State private var startDate: Date?

    /// 11.5rem 场高；信号区内缩 .75rem。rem 按 16pt 换算。
    private static let fieldHeight: Double = 184
    private static let signalsInset: Double = 12
    private static let dotSpacing: Double = 9

    /// 场内部固定浅色（dark 下整体 colorInvert，对齐 Web 的 filter:invert(1)）。
    private static let ink = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)

    var body: some View {
        Group {
            if reduceMotion {
                staticGrid
            } else {
                marquee
            }
        }
        .colorInvert(when: colorScheme == .dark)
        .accessibilityLabel("以从右向左滚动的弹幕展示智能体开发术语与个人技术栈")
    }

    // MARK: - 弹幕

    private var marquee: some View {
        GeometryReader { geometry in
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: startDate == nil)) { context in
                let elapsed = startDate.map { context.date.timeIntervalSince($0) } ?? 0
                let signalsHeight = Self.fieldHeight - Self.signalsInset * 2
                ZStack(alignment: .topLeading) {
                    dotGrid(size: geometry.size)
                    ForEach(Array(SignalFieldTerms.selectedTerms.enumerated()), id: \.offset) { index, term in
                        let track = SignalFieldTerms.track(index: index, total: SignalFieldTerms.selectedTerms.count)
                        let progress = SignalFieldTerms.progress(elapsed: elapsed, track: track)
                        let frame = SignalFieldTerms.marqueeFrame(progress: progress, width: geometry.size.width, drift: track.drift)
                        termPill(term, index: index)
                            .opacity(frame.opacity * track.opacity)
                            .offset(x: frame.x, y: Self.signalsInset + track.topFraction * signalsHeight + frame.yOffset)
                    }
                }
            }
        }
        .frame(height: Self.fieldHeight)
        .clipped()
        .overlay(alignment: .leading) { edgeFade(trailing: false) }
        .overlay(alignment: .trailing) { edgeFade(trailing: true) }
        .onAppear { if startDate == nil { startDate = Date() } }
    }

    private func dotGrid(size: CGSize) -> some View {
        Canvas { context, _ in
            var y = 0.0
            while y <= size.height {
                var x = 0.0
                while x <= size.width {
                    let rect = CGRect(x: x - 1, y: y - 1, width: 2, height: 2)
                    context.fill(Path(ellipseIn: rect), with: .color(Self.ink.opacity(0.27)))
                    x += Self.dotSpacing
                }
                y += Self.dotSpacing
            }
        }
    }

    private func edgeFade(trailing: Bool) -> some View {
        LinearGradient(
            colors: [.white, .white.opacity(0)],
            startPoint: trailing ? .trailing : .leading,
            endPoint: trailing ? .leading : .trailing
        )
        .frame(width: 16)
    }

    // MARK: - reduced-motion：词条静止均布

    private var staticGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 6) {
            ForEach(Array(SignalFieldTerms.selectedTerms.enumerated()), id: \.offset) { index, term in
                termPill(term, index: index)
            }
        }
        .padding(.vertical, 12)
        .frame(minHeight: Self.fieldHeight)
    }

    // MARK: - 词条胶囊

    private func termPill(_ term: String, index: Int) -> some View {
        let fontSize = SignalFieldTerms.fontSize(forIndex: index)
        return Text(term)
            .font(.system(size: fontSize, weight: .semibold, design: .monospaced))
            .tracking(-0.035 * fontSize)
            .lineLimit(1)
            .foregroundStyle(Self.ink.opacity(0.88))
            .padding(.horizontal, 8.6)
            .padding(.vertical, 7.4)
            .background(Color.white.opacity(0.94))
            .overlay(
                Rectangle()
                    .stroke(Self.ink.opacity(SignalFieldTerms.borderAlpha(forIndex: index)), lineWidth: 1)
            )
            .fixedSize()
    }
}

private extension View {
    @ViewBuilder
    func colorInvert(when condition: Bool) -> some View {
        if condition { colorInvert() } else { self }
    }
}
