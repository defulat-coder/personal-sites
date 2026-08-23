package com.personalsite

import com.personalsite.features.home.SignalFieldTerms
import kotlin.math.abs
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 信号场词条分配与滚动参数，逐项对齐 components/interactive-dot-field.tsx 的
 * trackStyle 与 globals.css 的 technical-term-marquee 关键帧（期望值由 TS 逻辑手算）。
 */
class SignalFieldTermsTests {
    private val total = 37

    @Test
    fun `词条集为固定种子的第三组加技术栈`() {
        val terms = SignalFieldTerms.selectedTerms
        assertEquals(37, terms.size)
        assertEquals("retry.policy", SignalFieldTerms.selectTechnicalTerms(0.61).first())
        assertEquals(SignalFieldTerms.technicalTermSets[2], terms.subList(0, 12))
        assertEquals(SignalFieldTerms.techStackTerms, terms.subList(12, terms.size))
    }

    @Test
    fun `首词条零延时落在第一泳道`() {
        val track = SignalFieldTerms.track(index = 0, total = total)
        assertEquals(0, track.lane)
        assertEquals(0.02, track.topFraction, 1e-9)
        assertEquals(63.0, track.duration, 1e-9)
        assertEquals(0.0, track.delay, 1e-9)
        assertEquals(0.06 * 16, track.drift, 1e-9)
        assertEquals(0.62, track.opacity, 1e-9)
    }

    @Test
    fun `泳道按索引取模且带错位延时`() {
        // index 1：泳道 1，delay = -(0 + 0 + 1×1.7)。
        val second = SignalFieldTerms.track(index = 1, total = total)
        assertEquals(1, second.lane)
        assertEquals(69.0, second.duration, 1e-9)
        assertTrue(abs(second.delay - -1.7) < 1e-9)
        assertTrue(abs(second.drift - -0.09 * 16) < 1e-9)
        assertTrue(abs(second.opacity - 0.77) < 1e-9)

        // index 5：泳道 5，delay = -(5×1.7)。
        val sixth = SignalFieldTerms.track(index = 5, total = total)
        assertEquals(5, sixth.lane)
        assertEquals(66.0, sixth.duration, 1e-9)
        assertTrue(abs(sixth.delay - -8.5) < 1e-9)
    }

    @Test
    fun `同泳道分组轮换错开一个划过窗口`() {
        // 泳道 0 共 7 词（37 = 6×6 + 1），组大小 [3,2,2]：
        // index 6 → 组 1 槽 0，delay = -21；index 12 → 组 2 槽 0，delay = -42；
        // index 18 → 组 0 槽 1，delay = -(1/3)×21 = -7。
        assertEquals(-21.0, SignalFieldTerms.track(index = 6, total = total).delay, 1e-9)
        assertEquals(-42.0, SignalFieldTerms.track(index = 12, total = total).delay, 1e-9)
        assertTrue(abs(SignalFieldTerms.track(index = 18, total = total).delay - -7.0) < 1e-9)

        // 泳道 1 组 1 槽 0：delay = -(23 + 1×1.7) = -24.7。
        assertTrue(abs(SignalFieldTerms.track(index = 7, total = total).delay - -24.7) < 1e-9)
        // 泳道 2 组 0 槽 1（laneSize 6，subgroupSize 2）：delay = -(10 + 3.4) = -13.4。
        assertTrue(abs(SignalFieldTerms.track(index = 20, total = total).delay - -13.4) < 1e-9)
    }

    @Test
    fun `弹幕帧对齐关键帧节点`() {
        val width = 358.0
        // 0%：屏右外，透明度 0，漂移 +1。
        val start = SignalFieldTerms.marqueeFrame(progress = 0.0, width = width, drift = 1.0)
        assertEquals(width + 56, start.x, 1e-9)
        assertEquals(0.0, start.opacity, 1e-9)
        assertEquals(1.0, start.yOffset, 1e-9)
        // 16%：translate 50% - 4.25rem，漂移 -1，透明度满。
        val mid = SignalFieldTerms.marqueeFrame(progress = 0.16, width = width, drift = 1.0)
        assertTrue(abs(mid.x - (width * 0.5 - 68)) < 1e-9)
        assertEquals(1.0, mid.opacity, 1e-9)
        assertTrue(abs(mid.yOffset - -1.0) < 1e-9)
        // 33.34%：屏左外 -12rem，漂移回到 +1。
        val end = SignalFieldTerms.marqueeFrame(progress = 0.3334, width = width, drift = 1.0)
        assertEquals(-192.0, end.x, 1e-9)
        assertEquals(1.0, end.yOffset, 1e-9)
        // 30%：淡出中（28.67% → 30.67% 线性到 0）。
        val fading = SignalFieldTerms.marqueeFrame(progress = 0.30, width = width, drift = 1.0)
        assertTrue(abs(fading.opacity - (1 - (0.30 - 0.2867) / 0.02)) < 1e-9)
        // 周期后 2/3 停在屏外隐藏。
        val hidden = SignalFieldTerms.marqueeFrame(progress = 0.5, width = width, drift = 1.0)
        assertEquals(-192.0, hidden.x, 1e-9)
        assertEquals(0.0, hidden.opacity, 1e-9)
    }

    @Test
    fun `负delay换算为已开播相位`() {
        val track = SignalFieldTerms.track(index = 1, total = total) // delay -1.7，duration 69
        assertTrue(abs(SignalFieldTerms.progress(elapsed = 0.0, track = track) - 1.7 / 69) < 1e-9)
        assertTrue(abs(SignalFieldTerms.progress(elapsed = 69.0, track = track) - 1.7 / 69) < 1e-9)
    }
}
