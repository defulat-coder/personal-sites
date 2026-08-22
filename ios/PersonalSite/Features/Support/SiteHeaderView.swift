import SwiftUI

enum AppTab: String, CaseIterable, Identifiable {
    case home
    case aiNews
    case following
    case works
    case ask

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: return "首页"
        case .aiNews: return "动态"
        case .following: return "关注"
        case .works: return "构建"
        case .ask: return "问一问"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "house"
        case .aiNews: "clock"
        case .following: "bookmark"
        case .works: "cube"
        case .ask: "bubble.left"
        }
    }
}

/// 月亮/太阳切换：与 Web localStorage 同名概念 light / dark / system（默认跟随系统）。
struct ThemeToggleButton: View {
    @AppStorage("curation-theme") private var theme = "system"
    @Environment(\.colorScheme) private var colorScheme

    private var isDark: Bool { theme == "system" ? colorScheme == .dark : theme == "dark" }

    var body: some View {
        Button {
            withAnimation(PSMotion.symbol) {
                theme = isDark ? "light" : "dark"
            }
        } label: {
            SplitToneSunIcon()
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PSPressButtonStyle())
        .accessibilityLabel(isDark ? "切换为浅色主题" : "切换为深色主题")
    }
}

private struct SplitToneSunIcon: View {
    var body: some View {
        ZStack {
            Image(systemName: "sun.max.fill")
                .foregroundStyle(Color.psQuiet)

            Image(systemName: "sun.max.fill")
                .foregroundStyle(Color.white)
                .mask {
                    HStack(spacing: 0) {
                        Color.clear
                        Color.white
                    }
                }

            Image(systemName: "sun.max")
                .foregroundStyle(Color.psInk.opacity(0.74))
        }
        .font(.system(size: 15, weight: .regular))
        .frame(width: 18, height: 18)
        .accessibilityHidden(true)
    }
}

struct PSPressButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.78 : 1)
            .animation(configuration.isPressed ? nil : PSMotion.press, value: configuration.isPressed)
    }
}

/// 外链入口（图标 + 文字），对齐 Web 的 curation-home__external-links。
struct ProfileLinkItem: View {
    let title: String
    let systemImage: String
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 10, weight: .medium))
                Text(title)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(Color.psLink)
        }
    }
}

struct ProfileLinkButton: View {
    let title: String
    let systemImage: String
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 10, weight: .medium))
                Text(title)
                    .font(.system(size: 12, weight: .medium))
            }
            .foregroundStyle(Color.psLink)
        }
        .buttonStyle(PSPressButtonStyle())
    }
}

/// 链接之间的 1px 竖线分隔。
struct ProfileLinkSeparator: View {
    var body: some View {
        Rectangle()
            .fill(Color.psLine)
            .frame(width: 1, height: 12)
    }
}

struct ProfileHeaderContent: View {
    nonisolated static let expandedTimelineTrailingInset: CGFloat = 18
    nonisolated static let expandedLinksTrailingInset: CGFloat = 10

    var onShowAbout: () -> Void
    var careerTimelinePlayed = true
    var onCareerTimelinePlayed: () -> Void = {}

    var body: some View {
        ZStack(alignment: .topTrailing) {
            HStack(alignment: .top, spacing: 24) {
                avatar(size: 104, radius: 12)
                VStack(alignment: .leading, spacing: 0) {
                    name
                    handle.padding(.top, 2.9)
                    CareerTimelineView(
                        shouldAnimateEntrance: !careerTimelinePlayed,
                        onEntranceCompleted: onCareerTimelinePlayed
                    )
                    .padding(.top, 7)
                    .transition(.opacity)
                    Spacer(minLength: 0)
                    HStack(spacing: 0) {
                        github
                        Spacer(minLength: 6)
                        ProfileLinkSeparator()
                        Spacer(minLength: 6)
                        yuque
                        Spacer(minLength: 6)
                        ProfileLinkSeparator()
                        Spacer(minLength: 6)
                        about
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.trailing, Self.expandedLinksTrailingInset)
                }
                .padding(.top, 8)
                .frame(height: 104)
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            themeButton
        }
    }

    private func avatar(size: CGFloat, radius: CGFloat) -> some View {
        Image("Avatar")
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: size, height: size)
            .clipShape(.rect(cornerRadius: radius))
    }

    private var name: some View {
        Text("陈远")
            .font(.system(size: 15.2, weight: .semibold))
            .tracking(-0.035 * 15.2)
            .foregroundStyle(Color.psInk)
    }

    private var handle: some View {
        Text("@defulat-coder")
            .font(.system(size: 12.5))
            .tracking(-0.02 * 12.5)
            .foregroundStyle(Color.psQuiet)
    }

    private var github: some View {
        ProfileLinkItem(title: "GitHub", systemImage: "arrow.triangle.branch", url: "https://github.com/defulat-coder")
    }

    private var yuque: some View {
        ProfileLinkItem(title: "语雀", systemImage: "book", url: "https://www.yuque.com/defulat-coder")
    }

    private var about: some View {
        ProfileLinkButton(title: "关于我", systemImage: "printer", action: onShowAbout)
    }

    private var themeButton: some View {
        ThemeToggleButton()
    }
}

struct ContentPageHeader: View {
    let title: String
    let subtitle: String
    var leadingSystemImage: String? = nil
    var isCollapsed = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if isCollapsed {
                HStack(spacing: 10) {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(Color.psInk)
                    Spacer(minLength: 0)
                    ThemeToggleButton()
                }
                .frame(height: 52)
                .padding(.leading, 16)
                .padding(.trailing, 8)
                .transition(.opacity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        if let leadingSystemImage {
                            Image(systemName: leadingSystemImage)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(Color.psInk)
                                .frame(width: 32, height: 32)
                                .background(Color.psLine.opacity(0.28), in: .rect(cornerRadius: 8))
                                .accessibilityHidden(true)
                        } else {
                            Image("Avatar")
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 32, height: 32)
                                .clipShape(.rect(cornerRadius: 8))
                        }
                        Text(leadingSystemImage == nil ? "陈远" : title)
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundStyle(Color.psInk)
                        Spacer(minLength: 0)
                        ThemeToggleButton()
                    }

                    if leadingSystemImage == nil {
                        Text(title)
                            .font(.system(size: 22, weight: .semibold))
                            .tracking(-0.02 * 22)
                            .foregroundStyle(Color.psInk)
                            .padding(.top, 10)
                    }

                    Text(subtitle)
                        .font(.system(size: 13, weight: .regular))
                        .foregroundStyle(Color.psQuiet)
                        .padding(.top, leadingSystemImage == nil ? 3 : 8)
                }
                .padding(.horizontal, 16)
                .padding(.top, 6)
                .padding(.bottom, 12)
                .transition(.opacity)
            }
        }
        .background(Color.psSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.psLine)
                .frame(height: 0.5)
        }
        .animation(
            reduceMotion ? .easeOut(duration: 0.12) : .spring(duration: 0.28, bounce: 0),
            value: isCollapsed
        )
    }
}
