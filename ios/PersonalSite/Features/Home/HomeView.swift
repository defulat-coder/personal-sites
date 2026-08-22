import SwiftUI

/// 首页：扩展版身份头 + 导航 + 信号场弹幕 + Bio 打字机，
/// 对齐 Web 移动端首页（mobileSection="home"）。整页随 ScrollView 一起滚动，
/// 与 Web 移动端 profile 非 sticky 的行为一致。
struct HomeView: View {
    /// Loader 滑出完成后开播 Bio 首访序列。
    var loaderFinished: Bool
    /// 会话内首访序列只播一次（App 级状态）。
    var bioPlayed: Bool
    var onBioPlayed: () -> Void
    var onSelect: (SiteSection) -> Void

    var navigationNamespace: Namespace.ID

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HomeIdentityHeader(navigationNamespace: navigationNamespace)

                SectionNavigationRow(
                    current: .home,
                    showsHairline: false,
                    horizontalPadding: 0,
                    onSelect: onSelect,
                    navigationNamespace: navigationNamespace,
                    indicatorIsSource: false
                )
                .padding(.top, 16)

                HomeBodyView(
                    loaderFinished: loaderFinished,
                    bioPlayed: bioPlayed,
                    onBioPlayed: onBioPlayed
                )
            }
            .padding(.horizontal, 32)
        }
        .scrollContentBackground(.hidden)
        .background(Color.psSurface)
    }
}

/// 扩展版身份头（仅首页）：大头像、「陈远」粗体 + 灰 @defulat-coder 两行、
/// 链接行 GitHub｜语雀 折行 ｜关于我、右上月亮，对齐 components/site-profile.tsx。
struct HomeIdentityHeader: View {
    var navigationNamespace: Namespace.ID

    var body: some View {
        ProfileHeaderContent(mode: .expanded, namespace: navigationNamespace)
    }
}

struct HomeBodyView: View {
    var loaderFinished: Bool
    var bioPlayed: Bool
    var onBioPlayed: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            SignalFieldView()
                .padding(.top, 26.4)

            BioView(
                startSignal: loaderFinished,
                shouldPlaySequence: !bioPlayed,
                onSequenceCompleted: onBioPlayed
            )
            .padding(.top, 27.2)
            .padding(.bottom, 28.8)
        }
    }
}
