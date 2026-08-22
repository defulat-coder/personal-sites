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
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var navigationNamespace
    @AppStorage("curation-theme") private var theme = "system"
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false

    @State private var section: SiteSection = UserDefaults.standard.string(forKey: "initialSection")
        .flatMap(SiteSection.init(rawValue:)) ?? .home
    @State private var direction: SectionTransitionDirection = .forward
    @State private var bioPlayed = false

    private var showWelcome: Bool {
        !hasSeenWelcome && !UserDefaults.standard.bool(forKey: "skipLoader")
    }

    var body: some View {
        ZStack {
            sectionSurface
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
        }
        .preferredColorScheme(theme == "system" ? nil : theme == "dark" ? .dark : .light)
    }

    @ViewBuilder
    private var sectionSurface: some View {
        ZStack(alignment: .top) {
            if section == .home {
                HomeView(
                    loaderFinished: !showWelcome,
                    bioPlayed: bioPlayed,
                    onBioPlayed: { bioPlayed = true },
                    onSelect: selectSection,
                    navigationNamespace: navigationNamespace
                )
                .transition(ProfileEndpointRetentionTransition())
            } else {
                VStack(spacing: 0) {
                    SiteHeaderView(
                        current: section,
                        onSelect: selectSection,
                        navigationNamespace: navigationNamespace
                    )
                    ZStack {
                        sectionContent
                            .id(section)
                            .transition(contentTransition)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
                    .animation(reduceMotion ? PSMotion.stateChange : PSMotion.section, value: section)
                }
                .transition(ProfileEndpointRetentionTransition())
            }
        }
    }

    private func selectSection(_ destination: SiteSection) {
        guard destination != section else { return }
        direction = SiteSection.transitionDirection(from: section, to: destination)
        let changesProfileMode = section == .home || destination == .home
        let animation = reduceMotion
            ? PSMotion.stateChange
            : (changesProfileMode ? PSMotion.profile : PSMotion.section)
        withAnimation(animation) {
            section = destination
        }
    }

    private var contentTransition: AnyTransition {
        guard !reduceMotion else { return .opacity }
        let insertion = direction == .forward ? 12.0 : -12.0
        return .asymmetric(
            insertion: .offset(x: insertion).combined(with: .opacity),
            removal: .offset(x: -insertion).combined(with: .opacity)
        )
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

/// Keeps both profile endpoints in the render tree for the spring without adding
/// a visible whole-screen transition. The tiny sub-pixel transform is imperceptible.
private struct ProfileEndpointRetentionTransition: Transition {
    func body(content: Content, phase: TransitionPhase) -> some View {
        content.offset(x: phase.isIdentity ? 0 : 0.001)
    }
}

enum SectionTransitionDirection: Equatable {
    case forward
    case backward
}

extension SiteSection {
    static func transitionDirection(from source: SiteSection, to destination: SiteSection) -> SectionTransitionDirection {
        let sourceIndex = allCases.firstIndex(of: source) ?? 0
        let destinationIndex = allCases.firstIndex(of: destination) ?? 0
        return destinationIndex >= sourceIndex ? .forward : .backward
    }
}
