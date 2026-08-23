package com.personalsite

import com.personalsite.features.home.BioAnimationSnapshot
import com.personalsite.features.home.BioCopy
import com.personalsite.features.home.CareerTimelineSpec
import com.personalsite.features.home.ProfileHeaderInsets
import com.personalsite.features.home.SignalFieldActivity
import com.personalsite.features.support.AppTab
import com.personalsite.features.support.FollowingMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MotionBehaviorTests {
    @Test
    fun `appShellUsesFivePrimaryTabsAndTwoFollowingModes`() {
        assertEquals(
            listOf(AppTab.HOME, AppTab.AI_NEWS, AppTab.FOLLOWING, AppTab.WORKS, AppTab.ASK),
            AppTab.entries,
        )
        assertEquals(
            listOf(FollowingMode.RECOMMENDATIONS, FollowingMode.OPEN_SOURCE),
            FollowingMode.entries,
        )
    }

    @Test
    fun `careerTimelineShowsTheFourPublicMilestones`() {
        assertEquals(listOf("2014", "2019", "2023", "2026"), CareerTimelineSpec.years)
        assertEquals(3, CareerTimelineSpec.arrowCount)
        assertEquals(18f, ProfileHeaderInsets.EXPANDED_TIMELINE_TRAILING)
        assertEquals(10f, ProfileHeaderInsets.EXPANDED_LINKS_TRAILING)
        assertTrue(
            ProfileHeaderInsets.EXPANDED_TIMELINE_TRAILING > ProfileHeaderInsets.EXPANDED_LINKS_TRAILING
        )
        assertEquals(12.2, CareerTimelineSpec.FONT_SIZE, 1e-9)
        assertTrue(CareerTimelineSpec.opacity(3) > CareerTimelineSpec.opacity(0))
        assertEquals(18f, CareerTimelineSpec.RUNNER_WIDTH)
        assertTrue(CareerTimelineSpec.STAGE_HEIGHT >= CareerTimelineSpec.RUNNER_HEIGHT)
        assertTrue(CareerTimelineSpec.runnerCenterX(progress = 1f, width = 200f) > 200f)
        assertFalse(
            CareerTimelineSpec.shouldRenderRunner(
                shouldAnimateEntrance = false,
                reduceMotion = false,
            )
        )
    }

    @Test
    fun `bioFinalSnapshotIsCompleteChineseCopy`() {
        val snapshot = BioAnimationSnapshot.final
        assertEquals(BioCopy.chineseTitle.length, snapshot.titleVisibleCount)
        assertEquals(BioCopy.profileCopy.map { it.length }, snapshot.visibleCounts)
    }

    @Test
    fun `signalFieldOnlyAnimatesWhenAllActivityConditionsPass`() {
        assertTrue(SignalFieldActivity.shouldAnimate(reduceMotion = false, sceneIsActive = true, isVisible = true))
        assertFalse(SignalFieldActivity.shouldAnimate(reduceMotion = true, sceneIsActive = true, isVisible = true))
        assertFalse(SignalFieldActivity.shouldAnimate(reduceMotion = false, sceneIsActive = false, isVisible = true))
        assertFalse(SignalFieldActivity.shouldAnimate(reduceMotion = false, sceneIsActive = true, isVisible = false))
    }
}
