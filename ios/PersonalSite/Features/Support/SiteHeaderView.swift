import SwiftUI

/// 内容板块，顺序与标签对齐 Web 端 site-section-navigation.tsx；「首页」仅出现在
/// 移动端导航第一位，对应 Web 的 mobileSection="home"。
enum SiteSection: String, CaseIterable, Identifiable {
    case home
    case aiNews
    case daily
    case openSource
    case works
    case ask

    var id: String { rawValue }

    var label: String {
        switch self {
        case .home: return "首页"
        case .aiNews: return "每日动态"
        case .daily: return "推特点赞"
        case .openSource: return "开源关注"
        case .works: return "构建"
        case .ask: return "问一问"
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
            theme = isDark ? "light" : "dark"
        } label: {
            Image(systemName: isDark ? "sun.max" : "moon")
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(Color.psInk)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(isDark ? "切换为浅色主题" : "切换为深色主题")
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

/// 链接之间的 1px 竖线分隔。
struct ProfileLinkSeparator: View {
    var body: some View {
        Rectangle()
            .fill(Color.psLine)
            .frame(width: 1, height: 12)
    }
}

/// 横向导航行：当前项粗体 + 短下划线。首页不在行尾画 hairline（对齐 Web 移动端
/// mobileNavigation 无下边框），其余板块保留 hairline。
struct SectionNavigationRow: View {
    var current: SiteSection
    var showsHairline = true
    /// 行内左右留白；首页整页已有 32pt 页边距（对齐 Web mobileNavigation 的
    /// margin:-2rem + padding:0 2rem），传 0 避免双重缩进。
    var horizontalPadding: Double = 16
    var onSelect: (SiteSection) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 16) {
                    ForEach(SiteSection.allCases) { section in
                        Button {
                            onSelect(section)
                        } label: {
                            Text(section.label)
                                .font(.system(size: 13, weight: current == section ? .semibold : .regular))
                                .foregroundStyle(current == section ? Color.psInk : Color.psLink)
                                .padding(.vertical, 10)
                                .overlay(alignment: .bottom) {
                                    if current == section {
                                        Rectangle()
                                            .fill(Color.psInk)
                                            .frame(height: 1.5)
                                    }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, horizontalPadding)
            }
            if showsHairline {
                Rectangle()
                    .fill(Color.psLine)
                    .frame(height: 0.5)
            }
        }
    }
}

/// 紧凑身份头 + 横向导航行，对齐 Web 移动端非首页板块：小号圆角头像、「陈远 @defulat-coder」一行、
/// 链接行（GitHub｜语雀｜关于我，细分隔竖线）、右上角月亮切换深浅色；
/// 导航当前项粗体 + 短下划线，行下 hairline。
struct SiteHeaderView: View {
    var current: SiteSection
    var onSelect: (SiteSection) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Image("Avatar")
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 44, height: 44)
                    .clipShape(.rect(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("陈远")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.psInk)
                        Text("@defulat-coder")
                            .font(.system(size: 12.5))
                            .foregroundStyle(Color.psQuiet)
                    }
                    HStack(spacing: 12) {
                        ProfileLinkItem(title: "GitHub", systemImage: "arrow.triangle.branch", url: "https://github.com/defulat-coder")
                        ProfileLinkSeparator()
                        ProfileLinkItem(title: "语雀", systemImage: "book", url: "https://www.yuque.com/defulat-coder")
                        ProfileLinkSeparator()
                        ProfileLinkItem(title: "关于我", systemImage: "printer", url: Config.siteBaseURL.absoluteString)
                    }
                }
                Spacer(minLength: 0)
                ThemeToggleButton()
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)

            SectionNavigationRow(current: current, onSelect: onSelect)
                .padding(.top, 14)
        }
        .background(Color.psSurface)
    }
}
