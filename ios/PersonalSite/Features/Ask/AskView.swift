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
        .all: "全部",
        .aiNews: "每日动态",
        .daily: "推特点赞",
        .openSource: "开源关注",
    ]

    var canSend: Bool {
        !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isStreaming && visitorId != nil
    }

    func send() {
        let question = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canSend, let visitorId else { return }
        input = ""
        bannerMessage = nil
        messages.append(AskMessage(role: .user, text: question))
        messages.append(AskMessage(role: .assistant, text: "", isStreaming: true))
        isStreaming = true
        streamTask = Task { await streamAnswer(question: question, visitorId: visitorId) }
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
    @State private var model = AskChatModel()

    var body: some View {
        VStack(spacing: 0) {
            messageList
            Divider().overlay(Color.psLine)
            composer
        }
        .background(Color.psSurface)
        .onDisappear { model.cancelStream() }
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    if let banner = model.bannerMessage {
                        Text(banner)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 8))
                    }
                    if model.messages.isEmpty {
                        Text("问问这些公开资料，回答基于 AI 动态、推特点赞与开源关注。")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.top, 48)
                    }
                    ForEach(model.messages) { message in
                        AskMessageBubble(message: message)
                            .id(message.id)
                    }
                }
                .padding()
            }
            .onChange(of: model.messages.count) {
                scrollToBottom(proxy)
            }
            .onChange(of: model.messages.last?.text) {
                scrollToBottom(proxy)
            }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        guard let lastID = model.messages.last?.id else { return }
        withAnimation { proxy.scrollTo(lastID, anchor: .bottom) }
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Menu {
                Picker("检索范围", selection: $model.scope) {
                    ForEach(AskScope.allCases, id: \.self) { scope in
                        Text(AskChatModel.scopeLabels[scope] ?? scope.rawValue).tag(scope)
                    }
                }
            } label: {
                HStack(spacing: 4) {
                    Text(AskChatModel.scopeLabels[model.scope] ?? "")
                        .font(.subheadline)
                    Image(systemName: "chevron.down")
                        .font(.caption2)
                }
                .foregroundStyle(Color.psLink)
            }
            TextField("问问这些公开资料…", text: $model.input, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...5)
                .onSubmit { model.send() }
            Button { model.send() } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
            }
            .disabled(!model.canSend)
        }
        .padding()
    }
}

private struct AskMessageBubble: View {
    let message: AskMessage

    var body: some View {
        switch message.role {
        case .user:
            HStack {
                Spacer(minLength: 48)
                Text(message.text)
                    .padding(10)
                    .background(Color(uiColor: .secondarySystemBackground), in: .rect(cornerRadius: 12))
            }
        case .assistant:
            VStack(alignment: .leading, spacing: 8) {
                if message.text.isEmpty, message.isStreaming {
                    ProgressView()
                } else {
                    MarkdownText(markdown: message.text)
                        .textSelection(.enabled)
                }
                if message.failed {
                    Label("这条回答不完整", systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
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
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
