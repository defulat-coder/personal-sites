import SwiftUI

/// 策展列表：走站点 /api/curation 分页（20/页，offset 服务端会向下取整）。
@MainActor
@Observable
final class CurationListModel {
    private(set) var items: [CurationListItem] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var hasMore = true

    private static let pageSize = 20

    var isEmpty: Bool { items.isEmpty }

    func loadInitial() async {
        guard items.isEmpty, !isLoading else { return }
        await load(reset: true)
    }

    func refresh() async {
        await load(reset: true)
    }

    func loadMoreIfNeeded(currentItem: CurationListItem) async {
        guard hasMore, !isLoading, currentItem.id == items.last?.id else { return }
        await load(reset: false)
    }

    private func load(reset: Bool) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        let offset = reset ? 0 : items.count
        do {
            let page: CurationPage = try await SiteAPIClient().get(
                "/api/curation",
                queryItems: [
                    URLQueryItem(name: "limit", value: String(Self.pageSize)),
                    URLQueryItem(name: "offset", value: String(offset)),
                ]
            )
            // 与 Web 客户端一致：offset 取整可能带回重复条目，按 id 去重丢弃。
            let known = Set(items.map(\.id))
            let fresh = reset ? page.items : page.items.filter { !known.contains($0.id) }
            items = reset ? page.items : items + fresh
            hasMore = page.hasMore
        } catch {
            errorMessage = "读取策展失败，请检查网络后重试。"
        }
    }
}

struct CurationView: View {
    @State private var model = CurationListModel()

    var body: some View {
        NavigationStack {
            LoadStateView(
                isLoading: model.isLoading && model.isEmpty,
                errorMessage: model.isEmpty ? model.errorMessage : nil,
                isEmpty: model.isEmpty,
                emptyMessage: "暂无策展内容",
                onRetry: { Task { await model.refresh() } }
            ) {
                List(model.items) { item in
                    NavigationLink(value: item.id) {
                        CurationRow(item: item)
                    }
                    .onAppear {
                        Task { await model.loadMoreIfNeeded(currentItem: item) }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await model.refresh() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .background(Color.psSurface)
            .navigationDestination(for: String.self) { id in
                CurationDetailView(id: id)
            }
        }
        .task { await model.loadInitial() }
    }
}

private struct CurationRow: View {
    let item: CurationListItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(item.title)
                .font(.headline)
            if !item.summary.isEmpty {
                Text(item.summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            HStack(spacing: 8) {
                Text("@\(item.author.handle)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                ForEach(item.tags.prefix(3), id: \.self) { tag in
                    Text(tag)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .overlay(Capsule().stroke(Color.secondary, lineWidth: 0.5))
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
        }
        .padding(.vertical, 4)
    }
}
