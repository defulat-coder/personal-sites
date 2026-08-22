import SwiftUI

/// AI 动态列表：直连 ai_news_public_items，按北京时间日分组，倒序分页。
@MainActor
@Observable
final class AiNewsListModel {
    private(set) var groups: [AiNewsDayGroup<AiNewsListItem>] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    private var offset = 0
    private var hasMore = true

    private static let pageSize = 50
    // 与 Web 端相同的 PostgREST 投影：content jsonb 字段别名平铺成行。
    private static let listSelect = "category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title"

    var isEmpty: Bool { groups.isEmpty }

    func loadInitial() async {
        guard groups.isEmpty, !isLoading else { return }
        await load(reset: true)
    }

    func refresh() async {
        await load(reset: true)
    }

    func loadMoreIfNeeded(currentItem: AiNewsListItem) async {
        let allItems = groups.flatMap(\.items)
        guard hasMore, !isLoading, currentItem.id == allItems.last?.id else { return }
        await load(reset: false)
    }

    private func load(reset: Bool) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        if reset {
            offset = 0
            hasMore = true
        }
        do {
            // 多取一条判断 hasMore，与 Web 的 getAiNewsPage 一致。
            let rows: [AiNewsListItem] = try await SupabaseClientProvider.shared
                .from("ai_news_public_items")
                .select(Self.listSelect)
                .order("published_at", ascending: false, nullsFirst: false)
                .range(from: offset, to: offset + Self.pageSize)
                .execute()
                .value
            hasMore = rows.count > Self.pageSize
            let pageItems = rows.prefix(Self.pageSize)
            let merged = reset ? Array(pageItems) : groups.flatMap(\.items) + pageItems
            offset += pageItems.count
            groups = AiNewsGrouping.group(merged) { $0.publishedAt }
        } catch {
            errorMessage = "读取每日动态失败，请检查网络后重试。"
        }
    }
}

struct AiNewsView: View {
    @State private var model = AiNewsListModel()
    var headerCollapsed: Binding<Bool>?

    private let scrollSpace = "ai-news-list-scroll"

    init(headerCollapsed: Binding<Bool>? = nil) {
        self.headerCollapsed = headerCollapsed
    }

    var body: some View {
        NavigationStack {
            LoadStateView(
                isLoading: model.isLoading && model.isEmpty,
                errorMessage: model.isEmpty ? model.errorMessage : nil,
                isEmpty: model.isEmpty,
                emptyMessage: "暂无每日动态",
                onRetry: { Task { await model.refresh() } }
            ) {
                List {
                    if let headerCollapsed {
                        ScrollCollapseSensor(
                            coordinateSpace: scrollSpace,
                            isCollapsed: headerCollapsed
                        )
                        .listRowInsets(.init())
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                    }
                    AiNewsStreamContent(model: model)
                }
                .listStyle(.plain)
                .environment(\.defaultMinListRowHeight, 1)
                .scrollContentBackground(.hidden)
                .coordinateSpace(.named(scrollSpace))
                .trackHeaderCollapse(headerCollapsed)
                .refreshable { await model.refresh() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .background(Color.psSurface)
            .navigationDestination(for: String.self) { id in
                AiNewsDetailView(id: id)
            }
        }
        .task { await model.loadInitial() }
    }
}

/// AI 动态内容流：日分组 + 行 + 滚动到底分页，供 AiNewsView（List）与
/// 首页（ScrollView 内嵌）共用；下钻由外层 NavigationStack 的
/// navigationDestination(for: String.self) 提供。
struct AiNewsStreamContent: View {
    let model: AiNewsListModel

    var body: some View {
        ForEach(model.groups, id: \.dayKey) { group in
            Section {
                ForEach(group.items) { item in
                    NavigationLink(value: item.id) {
                        AiNewsRow(item: item)
                    }
                    .contentListRowChrome()
                    .onAppear {
                        Task { await model.loadMoreIfNeeded(currentItem: item) }
                    }
                }
            } header: {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(group.label)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Color.psInk)
                    if !group.weekday.isEmpty {
                        Text(group.weekday)
                            .font(.system(size: ContentListMetrics.metadataSize, weight: .medium))
                            .foregroundStyle(Color.psQuiet)
                    }
                    Spacer(minLength: 0)
                }
                .textCase(nil)
                .padding(.top, 10)
                .padding(.bottom, 2)
                .background(Color.psSurface)
            }
        }
    }
}

struct AiNewsRow: View {
    let item: AiNewsListItem

    var body: some View {
        VStack(alignment: .leading, spacing: ContentListMetrics.rowSpacing) {
            ContentListMetadataLine(items: [
                AiNewsCategory.label(for: item.category),
                AiNewsGrouping.relativeTime(for: item.publishedAt) ?? "",
            ])
            Text(item.title)
                .contentListTitle()
                .lineLimit(2)
            if !item.summary.isEmpty {
                Text(item.summary)
                    .contentListSummary()
            }
        }
        .contentListBody()
    }
}
