import SwiftUI
import UIKit

/// 信号场：点阵背景 + 词条弹幕，对齐 components/interactive-dot-field.tsx。
/// 词条从右向左匀速划过六条水平泳道，参数全部由 SignalFieldTerms 的索引纯函数给出。
/// 深色模式对齐 Web 的 filter:invert(1)——内部固定浅色绘制，整体反色。
struct SignalFieldView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.scenePhase) private var scenePhase
    @State private var startDate: Date?
    @State private var isVisible = false

    /// 11.5rem 场高；信号区内缩 .75rem。rem 按 16pt 换算。
    private static let fieldHeight: Double = 184
    private static let signalsInset: Double = 12
    private static let dotSpacing: Double = 9

    /// 场内部固定浅色（dark 下整体 colorInvert，对齐 Web 的 filter:invert(1)）。
    private static let ink = Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255)
    private static let trackItems = SignalFieldTerms.selectedTerms.enumerated().map { index, term in
        SignalTrackItem(
            index: index,
            term: term,
            track: SignalFieldTerms.track(index: index, total: SignalFieldTerms.selectedTerms.count)
        )
    }

    private var shouldAnimate: Bool {
        SignalFieldActivity.shouldAnimate(
            reduceMotion: reduceMotion,
            sceneIsActive: scenePhase == .active,
            isVisible: isVisible
        )
    }

    var body: some View {
        let viewportHeight = UIScreen.main.bounds.height
        Group {
            if reduceMotion {
                staticGrid
            } else {
                marquee
            }
        }
        .colorInvert(when: colorScheme == .dark)
        .onGeometryChange(for: Bool.self) { [viewportHeight] proxy in
            let frame = proxy.frame(in: .global)
            return frame.maxY > 0 && frame.minY < viewportHeight
        } action: { visible in
            isVisible = visible
        }
        .accessibilityLabel("以从右向左滚动的弹幕展示智能体开发术语与个人技术栈")
    }

    // MARK: - 弹幕

    private var marquee: some View {
        GeometryReader { geometry in
            TimelineView(.animation(paused: startDate == nil || !shouldAnimate)) { context in
                let elapsed = startDate.map { context.date.timeIntervalSince($0) } ?? 0
                let signalsHeight = Self.fieldHeight - Self.signalsInset * 2
                ZStack(alignment: .topLeading) {
                    dotGrid(size: geometry.size)
                    ForEach(Self.trackItems) { item in
                        let progress = SignalFieldTerms.progress(elapsed: elapsed, track: item.track)
                        let frame = SignalFieldTerms.marqueeFrame(progress: progress, width: geometry.size.width, drift: item.track.drift)
                        termPill(item.term, index: item.index)
                            .opacity(frame.opacity * item.track.opacity)
                            .offset(x: frame.x, y: Self.signalsInset + item.track.topFraction * signalsHeight + frame.yOffset)
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

struct SignalFieldActivity {
    static func shouldAnimate(reduceMotion: Bool, sceneIsActive: Bool, isVisible: Bool) -> Bool {
        !reduceMotion && sceneIsActive && isVisible
    }
}

private struct SignalTrackItem: Identifiable {
    let index: Int
    let term: String
    let track: SignalFieldTerms.Track

    var id: Int { index }
}

private extension View {
    @ViewBuilder
    func colorInvert(when condition: Bool) -> some View {
        if condition { colorInvert() } else { self }
    }
}
