import Testing

@testable import PersonalSite

struct MotionBehaviorTests {
    @Test func sectionDirectionFollowsNavigationOrder() {
        #expect(SiteSection.transitionDirection(from: .home, to: .daily) == .forward)
        #expect(SiteSection.transitionDirection(from: .ask, to: .home) == .backward)
        #expect(SiteSection.transitionDirection(from: .daily, to: .daily) == .forward)
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
