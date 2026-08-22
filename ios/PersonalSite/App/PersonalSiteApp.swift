import SwiftUI

@main
struct PersonalSiteApp: App {
    /// light / dark / system，对齐 Web 的 curation-theme。
    @AppStorage("curation-theme") private var theme = "system"
    /// 调试用启动参数：-skipLoader YES 跳过开屏（用于模拟器截图验证）。
    @State private var showLoader = !UserDefaults.standard.bool(forKey: "skipLoader")
    /// 调试用启动参数：-initialSection ask 直接落到指定板块（用于模拟器截图验证）。
    @State private var section: SiteSection = UserDefaults.standard.string(forKey: "initialSection")
        .flatMap(SiteSection.init(rawValue:)) ?? .home
    /// 首页 Bio 首访序列会话内只播一次，对齐 Web 的 animateOnFirstHomeVisit。
    @State private var bioPlayed = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if section == .home {
                        HomeView(
                            loaderFinished: !showLoader,
                            bioPlayed: bioPlayed,
                            onBioPlayed: { bioPlayed = true },
                            onSelect: { section = $0 }
                        )
                    } else {
                        VStack(spacing: 0) {
                            SiteHeaderView(current: section) { section = $0 }
                            sectionContent
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
                .background(Color.psSurface.ignoresSafeArea())

                if showLoader {
                    OpeningLoaderView { showLoader = false }
                        .zIndex(1)
                }
            }
            .preferredColorScheme(theme == "system" ? nil : theme == "dark" ? .dark : .light)
        }
    }

    @ViewBuilder
    private var sectionContent: some View {
        switch section {
        case .home: EmptyView()
        case .aiNews: AiNewsView()
        case .daily: CurationView()
        case .openSource: OpenSourceView()
        case .works: WorksView()
        case .ask: AskView()
        }
    }
}
