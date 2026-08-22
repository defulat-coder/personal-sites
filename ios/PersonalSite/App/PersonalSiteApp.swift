import SwiftUI

@main
struct PersonalSiteApp: App {
    var body: some Scene {
        WindowGroup {
            PersonalSiteRootView()
        }
    }
}

struct PersonalSiteRootView: View {
    @AppStorage("curation-theme") private var theme = "system"
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false

    @State private var selectedTab: AppTab = .home
    @State private var bioPlayed = false
    @State private var careerTimelinePlayed = false
    @State private var showsAbout = false

    private var showWelcome: Bool {
        !hasSeenWelcome && !UserDefaults.standard.bool(forKey: "skipLoader")
    }

    var body: some View {
        ZStack {
            tabSurface
                .background(Color.psSurface.ignoresSafeArea())

            if showWelcome {
                WelcomeAnimationView {
                    withAnimation(PSMotion.stateChange) {
                        hasSeenWelcome = true
                    }
                }
                .transition(.opacity)
                .zIndex(10)
            }

            if showsAbout {
                AboutPrintView(onDismiss: dismissAbout)
                    .transition(.opacity)
                    .zIndex(20)
            }
        }
        .preferredColorScheme(theme == "system" ? nil : theme == "dark" ? .dark : .light)
    }

    private var tabSurface: some View {
        TabView(selection: $selectedTab) {
            TabContent(tab: .home) {
                HomeView(
                    loaderFinished: !showWelcome,
                    bioPlayed: bioPlayed,
                    onBioPlayed: { bioPlayed = true },
                    careerTimelinePlayed: careerTimelinePlayed,
                    onCareerTimelinePlayed: { careerTimelinePlayed = true },
                    onShowAbout: presentAbout
                )
            }
            TabContent(tab: .aiNews) {
                AiNewsTabView()
            }
            TabContent(tab: .following) {
                FollowingView()
            }
            TabContent(tab: .works) {
                WorksTabView()
            }
            TabContent(tab: .ask) {
                ContentTabScreen(
                    title: "问一问",
                    subtitle: "从公开动态、关注与工程记录中寻找答案",
                    leadingSystemImage: AppTab.ask.systemImage
                ) {
                    AskView()
                }
            }
        }
        .tint(Color.psInk)
        .modifier(NativeTabBarBehavior())
    }

    private func presentAbout() {
        withAnimation(PSMotion.stateChange) {
            showsAbout = true
        }
    }

    private func dismissAbout() {
        withAnimation(PSMotion.stateChange) {
            showsAbout = false
        }
    }

}

private struct AiNewsTabView: View {
    @State private var headerCollapsed = false

    var body: some View {
        VStack(spacing: 0) {
            ContentPageHeader(
                title: "每日动态",
                subtitle: "按时间跟踪正在发生的 AI 与 Agent 变化",
                isCollapsed: headerCollapsed
            )
            AiNewsView(headerCollapsed: $headerCollapsed)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.psSurface)
    }
}

private struct WorksTabView: View {
    @State private var headerCollapsed = false

    var body: some View {
        VStack(spacing: 0) {
            ContentPageHeader(
                title: "构建",
                subtitle: "正在运行、验证和持续维护的工程",
                isCollapsed: headerCollapsed
            )
            WorksView(headerCollapsed: $headerCollapsed)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.psSurface)
    }
}

private struct TabContent<Content: View>: View {
    let tab: AppTab
    @ViewBuilder let content: Content

    var body: some View {
        content
            .tabItem {
                Label(tab.label, systemImage: tab.systemImage)
            }
            .tag(tab)
    }
}

private struct NativeTabBarBehavior: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            content
        }
    }
}

private struct ContentTabScreen<Content: View>: View {
    let title: String
    let subtitle: String
    var leadingSystemImage: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            ContentPageHeader(
                title: title,
                subtitle: subtitle,
                leadingSystemImage: leadingSystemImage
            )
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color.psSurface)
    }
}
