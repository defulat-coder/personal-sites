import SwiftUI

enum ContentListMetrics {
    nonisolated static let titleSize: CGFloat = 15.5
    nonisolated static let summarySize: CGFloat = 13.5
    nonisolated static let metadataSize: CGFloat = 11.5
    nonisolated static let rowSpacing: CGFloat = 8
    nonisolated static let rowVerticalInset: CGFloat = 14
    nonisolated static let rowContentMinHeight: CGFloat = 108
}

struct ContentListMetadataLine: View {
    let items: [String]

    var body: some View {
        Text(items.filter { !$0.isEmpty }.joined(separator: " · "))
            .contentListMetadata()
            .lineLimit(1)
    }
}

struct ScrollCollapseSensor: View {
    let coordinateSpace: String
    @Binding var isCollapsed: Bool

    var body: some View {
        Color.clear
            .frame(height: 1)
            .accessibilityHidden(true)
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.frame(in: .named(coordinateSpace)).minY
            } action: { minY in
                let shouldCollapse = isCollapsed ? minY < -4 : minY < -20
                guard shouldCollapse != isCollapsed else { return }
                isCollapsed = shouldCollapse
            }
    }
}

extension View {
    @ViewBuilder
    func trackHeaderCollapse(_ binding: Binding<Bool>?) -> some View {
        if #available(iOS 18.0, *), let binding {
            onScrollGeometryChange(for: Bool.self) { geometry in
                geometry.contentOffset.y + geometry.contentInsets.top > 20
            } action: { _, isCollapsed in
                guard binding.wrappedValue != isCollapsed else { return }
                binding.wrappedValue = isCollapsed
            }
        } else {
            self
        }
    }

    func contentListTitle() -> some View {
        font(.system(size: ContentListMetrics.titleSize, weight: .medium))
            .foregroundStyle(Color.psInk)
            .lineSpacing(1)
    }

    func contentListSummary(lineLimit: Int = 2) -> some View {
        font(.system(size: ContentListMetrics.summarySize, weight: .regular))
            .foregroundStyle(Color.psQuiet)
            .lineSpacing(2)
            .lineLimit(lineLimit)
    }

    func contentListMetadata() -> some View {
        font(.system(size: ContentListMetrics.metadataSize, weight: .medium))
            .foregroundStyle(Color.psQuiet)
    }

    func contentListBody() -> some View {
        frame(
            maxWidth: .infinity,
            minHeight: ContentListMetrics.rowContentMinHeight,
            alignment: .topLeading
        )
        .contentShape(.rect)
    }

    func contentListRowChrome() -> some View {
        listRowInsets(EdgeInsets(
            top: ContentListMetrics.rowVerticalInset,
            leading: 16,
            bottom: ContentListMetrics.rowVerticalInset,
            trailing: 16
        ))
        .listRowSeparatorTint(Color.psLine)
        .listRowBackground(Color.psSurface)
        .navigationLinkIndicatorVisibility(.hidden)
    }
}
