import SwiftUI

/// 首页：扩展版身份头 + 信号场弹幕 + Bio 打字机。
struct HomeView: View {
    /// Loader 滑出完成后开播 Bio 首访序列。
    var loaderFinished: Bool
    /// 会话内首访序列只播一次（App 级状态）。
    var bioPlayed: Bool
    var onBioPlayed: () -> Void
    var careerTimelinePlayed: Bool
    var onCareerTimelinePlayed: () -> Void
    var onShowAbout: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HomeIdentityHeader(
                    onShowAbout: onShowAbout,
                    careerTimelinePlayed: careerTimelinePlayed,
                    onCareerTimelinePlayed: onCareerTimelinePlayed
                )

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
    var onShowAbout: () -> Void
    var careerTimelinePlayed: Bool
    var onCareerTimelinePlayed: () -> Void

    var body: some View {
        ProfileHeaderContent(
            onShowAbout: onShowAbout,
            careerTimelinePlayed: careerTimelinePlayed,
            onCareerTimelinePlayed: onCareerTimelinePlayed
        )
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
