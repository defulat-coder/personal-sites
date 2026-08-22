import SwiftUI
import UIKit

struct AskMessage: Identifiable, Equatable {
    enum Role { case user, assistant }

    let id = UUID()
    var role: Role
    var text: String
    var sources: [AskSource] = []
    var isStreaming = false
    var failed = false
}

/// 问一问对话模型：一问一答的顺序流，服务端按 IP 限流（50 次/10 分钟）。
@MainActor
@Observable
final class AskChatModel {
    var messages: [AskMessage] = []
    var input = ""
    var scope: AskScope = .all
    private(set) var isStreaming = false
    /// 429 / 流内 error 事件的顶部提示。
    private(set) var bannerMessage: String?

    private let conversationId = UUID().uuidString
    /// identifierForVendor 去掉连字符后是 32 位 hex，过服务端正则 ^[A-Za-z0-9_-]{16,128}$。
    private let visitorId = UIDevice.current.identifierForVendor?.uuidString.replacingOccurrences(of: "-", with: "")
    private var streamTask: Task<Void, Never>?

    static let scopeLabels: [AskScope: String] = [
        .all: "全部资料",
        .aiNews: "每日动态",
        .daily: "推特点赞",
        .openSource: "开源关注",
    ]

    var canSend: Bool {
        !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming && visitorId != nil
    }

    func send(_ suggestedQuestion: String? = nil) {
        let question = (suggestedQuestion ?? input).trimmingCharacters(in: .whitespacesAndNewlines)
        let canSubmit = !question.isEmpty && !isStreaming && visitorId != nil
        guard canSubmit, let visitorId else { return }
        input = ""
        bannerMessage = nil
        messages.append(AskMessage(role: .user, text: question))
        messages.append(AskMessage(role: .assistant, text: "", isStreaming: true))
        isStreaming = true
        streamTask = Task { await streamAnswer(question: question, visitorId: visitorId) }
    }

    func stopGenerating() {
        streamTask?.cancel()
        streamTask = nil
        updateLastAssistant {
            if $0.text.isEmpty {
                $0.text = "已停止生成。"
            }
            $0.isStreaming = false
        }
        isStreaming = false
    }

    /// 离开页面时调用：取消流，停止消费事件。
    func cancelStream() {
        streamTask?.cancel()
        finishStreaming()
    }

    private func finishStreaming() {
        isStreaming = false
        if let index = messages.indices.last, messages[index].isStreaming {
            messages[index].isStreaming = false
        }
    }

    private func streamAnswer(question: String, visitorId: String) async {
        defer { finishStreaming() }
        do {
            let events = try await SiteAPIClient().askEvents(
                conversationId: conversationId,
                visitorId: visitorId,
                question: question,
                scope: scope
            )
            for try await sseEvent in events {
                try Task.checkCancellation()
                switch try AskStreamEvent(event: sseEvent) {
                case .sources(let sources):
                    updateLastAssistant { $0.sources = sources }
                case .text(let delta):
                    updateLastAssistant { $0.text += delta }
                case .done:
                    break
                case .error(let message):
                    updateLastAssistant { $0.failed = true }
                    bannerMessage = message
                }
            }
        } catch is CancellationError {
            // 主动取消或离开页面：静默收尾。
        } catch SiteAPIClient.APIError.rateLimited(let retryAfter) {
            updateLastAssistant { $0.failed = true }
            bannerMessage = retryAfter.map { "提问过于频繁，请 \($0) 秒后再试。" } ?? "提问过于频繁，请稍后再试。"
        } catch {
            updateLastAssistant { $0.failed = true }
            bannerMessage = "回答暂时不可用，请稍后重试。"
        }
    }

    private func updateLastAssistant(_ mutate: (inout AskMessage) -> Void) {
        guard let index = messages.indices.last else { return }
        mutate(&messages[index])
    }
}

struct AskView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var model = AskChatModel()
    @State private var followsLatest = true
    @State private var messageViewportHeight: CGFloat = 0
    @FocusState private var composerFocused: Bool

    private let bottomID = "ask-bottom"
    private let suggestions = [
        AskSuggestion(
            title: "最近在关注什么？",
            detail: "从每日动态里找出正在发生的变化",
            prompt: "最近有哪些值得持续跟踪的 Agent 工程？"
        ),
        AskSuggestion(
            title: "哪些项目值得尝试？",
            detail: "结合推荐内容与开源判断给出答案",
            prompt: "哪些开源项目已经被提炼或计划试用？"
        ),
        AskSuggestion(
            title: "现在正在构建什么？",
            detail: "从工程档案总结当前验证方向",
            prompt: "目前正在构建和验证什么？"
        ),
    ]

    var body: some View {
        messageList
            .safeAreaInset(edge: .bottom, spacing: 0) {
                composer
            }
            .background(Color.psSurface)
            .onDisappear { model.cancelStream() }
    }

    private var messageList: some View {
        let viewportHeight = messageViewportHeight
        return ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    if let banner = model.bannerMessage {
                        Text(banner)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 8))
                            .transition(.opacity)
                    }
                    if model.messages.isEmpty {
                        AskEmptyState(suggestions: suggestions) { suggestion in
                            composerFocused = false
                            model.send(suggestion.prompt)
                        }
                        .padding(.top, 24)
                    }
                    ForEach(model.messages) { message in
                        AskMessageBubble(message: message)
                            .id(message.id)
                            .transition(messageTransition)
                    }
                    Color.clear
                        .frame(height: 1)
                        .id(bottomID)
                        .onGeometryChange(for: Bool.self) { [viewportHeight] proxy in
                            let frame = proxy.frame(in: .named("ask-scroll"))
                            return frame.minY >= 0 && frame.maxY <= viewportHeight + 8
                        } action: { isVisible in
                            followsLatest = isVisible
                        }
                }
                .padding()
                .animation(PSMotion.stateChange, value: model.messages.count)
            }
            .scrollDismissesKeyboard(.interactively)
            .coordinateSpace(.named("ask-scroll"))
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.height
            } action: { height in
                messageViewportHeight = height
            }
            .onChange(of: model.messages.count) {
                followsLatest = true
                withAnimation(PSMotion.stateChange) {
                    proxy.scrollTo(bottomID, anchor: .bottom)
                }
            }
            .onChange(of: model.messages.last?.text) {
                guard followsLatest else { return }
                var transaction = Transaction()
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    proxy.scrollTo(bottomID, anchor: .bottom)
                }
            }
            .animation(PSMotion.stateChange, value: model.bannerMessage != nil)
        }
    }

    private var messageTransition: AnyTransition {
        reduceMotion ? .opacity : .offset(y: 12).combined(with: .opacity)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("问任何公开记录…", text: $model.input, axis: .vertical)
                .font(.system(size: 16, weight: .regular))
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .focused($composerFocused)
                .onSubmit { model.send() }

            HStack(spacing: 8) {
                Menu {
                    Picker("检索范围", selection: $model.scope) {
                        ForEach(AskScope.allCases, id: \.self) { scope in
                            Text(AskChatModel.scopeLabels[scope] ?? scope.rawValue).tag(scope)
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "line.3.horizontal.decrease")
                        Text(AskChatModel.scopeLabels[model.scope] ?? "")
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .semibold))
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.psQuiet)
                    .frame(minHeight: 32)
                }
                .disabled(model.isStreaming)

                Spacer(minLength: 0)

                Button {
                    if model.isStreaming {
                        model.stopGenerating()
                    } else {
                        model.send()
                    }
                } label: {
                    Image(systemName: model.isStreaming ? "stop.fill" : "arrow.up")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(canSubmitOrStop ? Color.psSurface : Color.psQuiet)
                        .frame(width: 32, height: 32)
                        .background(
                            canSubmitOrStop ? Color.psInk : Color.psLine,
                            in: Circle()
                        )
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(PSPressButtonStyle())
                .disabled(!canSubmitOrStop)
                .accessibilityLabel(model.isStreaming ? "停止生成" : "发送")
            }
        }
        .padding(.leading, 14)
        .padding(.trailing, 8)
        .padding(.top, 12)
        .padding(.bottom, 6)
        .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color.psLine, lineWidth: 0.5)
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
        .background(Color.psSurface.opacity(0.96))
    }

    private var canSubmitOrStop: Bool {
        model.isStreaming || model.canSend
    }
}

private struct AskSuggestion: Identifiable {
    let title: String
    let detail: String
    let prompt: String

    var id: String { title }
}

private struct AskEmptyState: View {
    let suggestions: [AskSuggestion]
    let onSelect: (AskSuggestion) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("从哪里开始？")
                .font(.system(size: 22, weight: .semibold))
                .tracking(-0.02 * 22)
                .foregroundStyle(Color.psInk)

            Text("直接提问，回答只基于这个站点已经公开的内容。")
                .font(.system(size: 13.5, weight: .regular))
                .foregroundStyle(Color.psQuiet)
                .padding(.top, 4)
                .padding(.bottom, 18)

            ForEach(suggestions) { suggestion in
                Button {
                    onSelect(suggestion)
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(suggestion.title)
                                .font(.system(size: 14.5, weight: .semibold))
                                .foregroundStyle(Color.psInk)
                            Text(suggestion.detail)
                                .font(.system(size: 12.5, weight: .regular))
                                .foregroundStyle(Color.psQuiet)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(Color.psQuiet)
                            .padding(.top, 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 66, alignment: .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.psLine.opacity(0.18), in: .rect(cornerRadius: 14))
                    .contentShape(.rect)
                }
                .buttonStyle(PSPressButtonStyle())
                .padding(.bottom, 10)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AskMessageBubble: View {
    let message: AskMessage

    var body: some View {
        switch message.role {
        case .user:
            HStack {
                Spacer(minLength: 64)
                Text(message.text)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(Color.psSurface)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.psInk, in: .rect(cornerRadius: 18))
                    .textSelection(.enabled)
            }
        case .assistant:
            VStack(alignment: .leading, spacing: 10) {
                if message.text.isEmpty, message.isStreaming {
                    HStack(spacing: 8) {
                        ProgressView()
                            .controlSize(.small)
                        Text("正在整理公开资料…")
                            .font(.system(size: 13.5, weight: .regular))
                            .foregroundStyle(Color.psQuiet)
                    }
                        .transition(.opacity)
                } else {
                    MarkdownText(markdown: message.text)
                        .textSelection(.enabled)
                        .transition(.opacity)
                }
                if message.failed {
                    Label("这条回答不完整", systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .transition(.opacity)
                }
                if !message.sources.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("来源")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ForEach(message.sources) { source in
                            if let url = URL(string: source.sourceUrl) {
                                Link(destination: url) {
                                    Text(source.title)
                                        .font(.footnote)
                                        .lineLimit(1)
                                }
                            } else {
                                Text(source.title)
                                    .font(.footnote)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .transition(.opacity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .animation(PSMotion.stateChange, value: message.text.isEmpty && message.isStreaming)
            .animation(PSMotion.stateChange, value: message.failed)
            .animation(PSMotion.stateChange, value: message.sources.isEmpty)
        }
    }
}
