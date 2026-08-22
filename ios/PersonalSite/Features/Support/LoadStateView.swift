import SwiftUI

/// 轻量 Markdown 渲染：用系统 AttributedString(markdown:)，解析失败时退化为原文。
/// 仅支持行内语法，避免长文阻塞布局。
struct MarkdownText: View {
    let markdown: String

    var body: some View {
        Text(Self.render(markdown))
    }

    private static func render(_ markdown: String) -> AttributedString {
        var options = AttributedString.MarkdownParsingOptions(allowsExtendedAttributes: false)
        options.interpretedSyntax = .inlineOnlyPreservingWhitespace
        options.failurePolicy = .returnPartiallyParsedIfPossible
        return (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(markdown)
    }
}

/// 列表通用三态：加载中 / 失败重试 / 内容。空态由 emptyMessage 处理。
struct LoadStateView<Content: View>: View {
    var isLoading: Bool
    var errorMessage: String?
    var isEmpty: Bool
    var emptyMessage: String
    var onRetry: () -> Void
    @ViewBuilder var content: () -> Content

    private var stateIdentity: LoadStateIdentity {
        if isLoading { return .loading }
        if errorMessage != nil { return .error }
        if isEmpty { return .empty }
        return .content
    }

    var body: some View {
        ZStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let errorMessage {
                    ContentUnavailableView {
                        Label("加载失败", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(errorMessage)
                    } actions: {
                        Button("重试", action: onRetry)
                    }
                } else if isEmpty {
                    ContentUnavailableView {
                        Label(emptyMessage, systemImage: "tray")
                    }
                } else {
                    content()
                }
            }
            .id(stateIdentity)
            .transition(.opacity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(PSMotion.stateChange, value: stateIdentity)
    }
}

enum LoadStateIdentity: Hashable {
    case loading
    case error
    case empty
    case content
}
