import Foundation
import Testing

@testable import PersonalSite

/// 信号场词条分配与滚动参数，逐项对齐 components/interactive-dot-field.tsx 的
/// trackStyle 与 globals.css 的 technical-term-marquee 关键帧（期望值由 TS 逻辑手算）。
struct SignalFieldTermsTests {
    private let total = 37

    @Test func 词条集为固定种子的第三组加技术栈() {
        let terms = SignalFieldTerms.selectedTerms
        #expect(terms.count == 37)
        #expect(SignalFieldTerms.selectTechnicalTerms(0.61).first == "retry.policy")
        #expect(Array(terms.prefix(12)) == SignalFieldTerms.technicalTermSets[2])
        #expect(Array(terms.suffix(25)) == SignalFieldTerms.techStackTerms)
    }

    @Test func 首词条零延时落在第一泳道() {
        let track = SignalFieldTerms.track(index: 0, total: total)
        #expect(track.lane == 0)
        #expect(track.topFraction == 0.02)
        #expect(track.duration == 63)
        #expect(track.delay == 0)
        #expect(track.drift == 0.06 * 16)
        #expect(track.opacity == 0.62)
    }

    @Test func 泳道按索引取模且带错位延时() {
        // index 1：泳道 1，delay = -(0 + 0 + 1×1.7)。
        let second = SignalFieldTerms.track(index: 1, total: total)
        #expect(second.lane == 1)
        #expect(second.duration == 69)
        #expect(abs(second.delay - -1.7) < 1e-9)
        #expect(abs(second.drift - -0.09 * 16) < 1e-9)
        #expect(abs(second.opacity - 0.77) < 1e-9)

        // index 5：泳道 5，delay = -(5×1.7)。
        let sixth = SignalFieldTerms.track(index: 5, total: total)
        #expect(sixth.lane == 5)
        #expect(sixth.duration == 66)
        #expect(abs(sixth.delay - -8.5) < 1e-9)
    }

    @Test func 同泳道分组轮换错开一个划过窗口() {
        // 泳道 0 共 7 词（37 = 6×6 + 1），组大小 [3,2,2]：
        // index 6 → 组 1 槽 0，delay = -21；index 12 → 组 2 槽 0，delay = -42；
        // index 18 → 组 0 槽 1，delay = -(1/3)×21 = -7。
        #expect(SignalFieldTerms.track(index: 6, total: total).delay == -21)
        #expect(SignalFieldTerms.track(index: 12, total: total).delay == -42)
        #expect(abs(SignalFieldTerms.track(index: 18, total: total).delay - -7) < 1e-9)

        // 泳道 1 组 1 槽 0：delay = -(23 + 1×1.7) = -24.7。
        #expect(abs(SignalFieldTerms.track(index: 7, total: total).delay - -24.7) < 1e-9)
        // 泳道 2 组 0 槽 1（laneSize 6，subgroupSize 2）：delay = -(10 + 3.4) = -13.4。
        #expect(abs(SignalFieldTerms.track(index: 20, total: total).delay - -13.4) < 1e-9)
    }

    @Test func 弹幕帧对齐关键帧节点() {
        let width = 358.0
        // 0%：屏右外，透明度 0，漂移 +1。
        let start = SignalFieldTerms.marqueeFrame(progress: 0, width: width, drift: 1)
        #expect(start.x == width + 56)
        #expect(start.opacity == 0)
        #expect(start.yOffset == 1)
        // 16%：translate 50% - 4.25rem，漂移 -1，透明度满。
        let mid = SignalFieldTerms.marqueeFrame(progress: 0.16, width: width, drift: 1)
        #expect(abs(mid.x - (width * 0.5 - 68)) < 1e-9)
        #expect(mid.opacity == 1)
        #expect(abs(mid.yOffset - -1) < 1e-9)
        // 33.34%：屏左外 -12rem，漂移回到 +1。
        let end = SignalFieldTerms.marqueeFrame(progress: 0.3334, width: width, drift: 1)
        #expect(end.x == -192)
        #expect(end.yOffset == 1)
        // 30%：淡出中（28.67% → 30.67% 线性到 0）。
        let fading = SignalFieldTerms.marqueeFrame(progress: 0.30, width: width, drift: 1)
        #expect(abs(fading.opacity - (1 - (0.30 - 0.2867) / 0.02)) < 1e-9)
        // 周期后 2/3 停在屏外隐藏。
        let hidden = SignalFieldTerms.marqueeFrame(progress: 0.5, width: width, drift: 1)
        #expect(hidden.x == -192)
        #expect(hidden.opacity == 0)
    }

    @Test func 负delay换算为已开播相位() {
        let track = SignalFieldTerms.track(index: 1, total: total) // delay -1.7，duration 69
        #expect(abs(SignalFieldTerms.progress(elapsed: 0, track: track) - 1.7 / 69) < 1e-9)
        #expect(abs(SignalFieldTerms.progress(elapsed: 69, track: track) - 1.7 / 69) < 1e-9)
    }
}
