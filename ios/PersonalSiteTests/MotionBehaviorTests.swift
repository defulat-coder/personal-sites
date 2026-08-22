import Testing

@testable import PersonalSite

struct MotionBehaviorTests {
    @Test func appShellUsesFivePrimaryTabsAndTwoFollowingModes() {
        #expect(AppTab.allCases == [.home, .aiNews, .following, .works, .ask])
        #expect(FollowingMode.allCases == [.recommendations, .openSource])
    }

    @Test func careerTimelineShowsTheFourPublicMilestones() {
        #expect(CareerTimelineView.years == ["2014", "2019", "2023", "2026"])
        #expect(CareerTimelineView.arrowCount == 3)
        #expect(ProfileHeaderContent.expandedTimelineTrailingInset == 18)
        #expect(ProfileHeaderContent.expandedLinksTrailingInset == 10)
        #expect(
            ProfileHeaderContent.expandedTimelineTrailingInset
                > ProfileHeaderContent.expandedLinksTrailingInset
        )
        #expect(CareerTimelineView.fontSize == 12.2)
        #expect(CareerTimelineView.opacity(for: 3) > CareerTimelineView.opacity(for: 0))
        #expect(CareerTimelineView.runnerWidth == 18)
        #expect(CareerTimelineView.stageHeight >= CareerTimelineView.runnerHeight)
        #expect(CareerTimelineView.runnerCenterX(progress: 1, width: 200) > 200)
        #expect(!CareerTimelineView.shouldRenderRunner(
            shouldAnimateEntrance: false,
            reduceMotion: false
        ))
    }

    @Test func bioFinalSnapshotIsCompleteChineseCopy() {
        let snapshot = BioAnimationSnapshot.final
        #expect(snapshot.titleVisibleCount == BioView.chineseTitle.count)
        #expect(snapshot.visibleCounts == BioView.profileCopy.map(\.count))
    }

    @Test func signalFieldOnlyAnimatesWhenAllActivityConditionsPass() {
        #expect(SignalFieldActivity.shouldAnimate(reduceMotion: false, sceneIsActive: true, isVisible: true))
        #expect(!SignalFieldActivity.shouldAnimate(reduceMotion: true, sceneIsActive: true, isVisible: true))
        #expect(!SignalFieldActivity.shouldAnimate(reduceMotion: false, sceneIsActive: false, isVisible: true))
        #expect(!SignalFieldActivity.shouldAnimate(reduceMotion: false, sceneIsActive: true, isVisible: false))
    }
}
