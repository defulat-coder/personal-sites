import SwiftUI

/// 首页：扩展版身份头 + 导航 + 信号场弹幕 + Bio 打字机 + 每日动态内容流，
/// 对齐 Web 移动端首页（mobileSection="home"）。整页随 ScrollView 一起滚动，
/// 与 Web 移动端 profile 非 sticky 的行为一致。
struct HomeView: View {
    /// Loader 滑出完成后开播 Bio 首访序列。
    var loaderFinished: Bool
    /// 会话内首访序列只播一次（App 级状态）。
    var bioPlayed: Bool
    var onBioPlayed: () -> Void
    var onSelect: (SiteSection) -> Void

    @State private var model = AiNewsListModel()

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        HomeIdentityHeader()

                        SectionNavigationRow(current: .home, showsHairline: false, horizontalPadding: 0, onSelect: onSelect)
                            .padding(.top, 16)

                        SignalFieldView()
                            .padding(.top, 26.4)

                        BioView(
                            startSignal: loaderFinished,
                            shouldPlaySequence: !bioPlayed,
                            onSequenceCompleted: onBioPlayed
                        )
                        .padding(.top, 27.2)
                        .padding(.bottom, 28.8)

                        LoadStateView(
                            isLoading: model.isLoading && model.isEmpty,
                            errorMessage: model.isEmpty ? model.errorMessage : nil,
                            isEmpty: model.isEmpty,
                            emptyMessage: "暂无每日动态",
                            onRetry: { Task { await model.refresh() } }
                        ) {
                            LazyVStack(alignment: .leading, spacing: 0) {
                                AiNewsStreamContent(model: model)
                            }
                            // NavigationLink 在 List 之外会把 label 染成 accent 色，
                            // 对齐列表语义用 ink 覆盖。
                            .tint(Color.psInk)
                        }
                        .id("stream")
                    }
                    .padding(.horizontal, 32)
                }
                .task {
                    await model.loadInitial()
                    // 调试用启动参数 -scrollToStream YES：数据到位后直接滚到内容流（截图验证用）。
                    guard UserDefaults.standard.bool(forKey: "scrollToStream"), !model.groups.isEmpty else { return }
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    proxy.scrollTo("stream", anchor: .top)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.psSurface)
            .refreshable { await model.refresh() }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: String.self) { id in
                AiNewsDetailView(id: id)
            }
        }
    }
}

/// 扩展版身份头（仅首页）：大头像、「陈远」粗体 + 灰 @defulat-coder 两行、
/// 链接行 GitHub｜语雀 折行 ｜关于我、右上月亮，对齐 components/site-profile.tsx。
struct HomeIdentityHeader: View {
    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            Image("Avatar")
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 104, height: 104)
                .clipShape(.rect(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 0) {
                Text("陈远")
                    .font(.system(size: 15.2, weight: .semibold))
                    .tracking(-0.035 * 15.2)
                    .foregroundStyle(Color.psInk)
                Text("@defulat-coder")
                    .font(.system(size: 12.5))
                    .tracking(-0.02 * 12.5)
                    .foregroundStyle(Color.psQuiet)
                    .padding(.top, 2.9)
                HStack(spacing: 12.8) {
                    ProfileLinkItem(title: "GitHub", systemImage: "arrow.triangle.branch", url: "https://github.com/defulat-coder")
                    ProfileLinkSeparator()
                    ProfileLinkItem(title: "语雀", systemImage: "book", url: "https://www.yuque.com/defulat-coder")
                }
                .padding(.top, 16)
                HStack(spacing: 12.8) {
                    ProfileLinkSeparator()
                    ProfileLinkItem(title: "关于我", systemImage: "printer", url: Config.siteBaseURL.absoluteString)
                }
                .padding(.top, 6)
            }
            Spacer(minLength: 0)
            ThemeToggleButton()
        }
    }
}
