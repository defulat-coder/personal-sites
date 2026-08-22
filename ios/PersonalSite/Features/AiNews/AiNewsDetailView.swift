import SwiftUI

/// AI 动态详情：进页后按 id 拉完整行（reason/score/url 仅详情有）。
struct AiNewsDetailView: View {
    let id: String

    @State private var item: AiNewsItem?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let item {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(item.title)
                            .font(.title2)
                            .fontWeight(.semibold)
                        HStack(spacing: 8) {
                            Text(AiNewsCategory.label(for: item.category))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let relative = AiNewsGrouping.relativeTime(for: item.publishedAt) {
                                Text(relative)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Text(item.sourceName)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !item.summary.isEmpty {
                            MarkdownText(markdown: item.summary)
                        }
                        if !item.reason.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("评分理由")
                                    .font(.headline)
                                Text(item.reason)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        if let url = URL(string: item.url) {
                            Link("查看原文", destination: url)
                                .font(.headline)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            } else if let errorMessage {
                ContentUnavailableView {
                    Label("加载失败", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("重试") { Task { await load() } }
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle("动态详情")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        errorMessage = nil
        do {
            let row: AiNewsPublicRow = try await SupabaseClientProvider.shared
                .from("ai_news_public_items")
                .select("content,selected,published_at")
                .eq("id", value: id)
                .single()
                .execute()
                .value
            item = row.item
        } catch {
            errorMessage = "读取动态详情失败，请稍后重试。"
        }
    }
}
