import SwiftUI

enum FollowingMode: String, CaseIterable, Identifiable {
    case recommendations
    case openSource

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recommendations: "推荐"
        case .openSource: "开源"
        }
    }
}

struct FollowingView: View {
    @State private var mode: FollowingMode = .recommendations
    @State private var headerCollapsed = false

    var body: some View {
        VStack(spacing: 0) {
            ContentPageHeader(
                title: "关注",
                subtitle: "值得继续阅读、试用和长期跟踪的内容",
                isCollapsed: headerCollapsed
            )

            if !headerCollapsed {
                Picker("关注类型", selection: $mode) {
                    ForEach(FollowingMode.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color.psSurface)
                .transition(.opacity)
            }

            Group {
                switch mode {
                case .recommendations:
                    CurationView(headerCollapsed: $headerCollapsed)
                case .openSource:
                    OpenSourceView(headerCollapsed: $headerCollapsed)
                }
            }
            .id(mode)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .transition(.opacity)
        }
        .background(Color.psSurface)
        .animation(PSMotion.stateChange, value: mode)
        .animation(PSMotion.stateChange, value: headerCollapsed)
        .onChange(of: mode) {
            headerCollapsed = false
        }
    }
}
