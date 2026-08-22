import SwiftUI

/// 开源关注内部导航：列表 → 详情 → 仓库目录/文件。
enum OpenSourceRoute: Hashable {
    case detail(String)
    case directory(slug: String, path: String)
    case file(slug: String, path: String)
}

/// 开源关注列表：直连 github_open_source_items，排序与 Web 一致（display_rank 升序，再按 published_at 倒序）。
@MainActor
@Observable
final class OpenSourceListModel {
    private(set) var entries: [OpenSourceListEntry] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private static let listSelect = "category:content->>category,checkedAt:content->evidence->>checkedAt,dimensions:content->dimensions,repository:content->>repository,slug,sourceSummary:content->>sourceSummary,status:content->>status,type:content->>type"

    var isEmpty: Bool { entries.isEmpty }

    func loadInitial() async {
        guard entries.isEmpty, !isLoading else { return }
        await load()
    }

    func refresh() async {
        await load()
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            entries = try await SupabaseClientProvider.shared
                .from("github_open_source_items")
                .select(Self.listSelect)
                .order("display_rank", ascending: true, nullsFirst: false)
                .order("published_at", ascending: false)
                .execute()
                .value
        } catch {
            errorMessage = "读取开源关注失败，请检查网络后重试。"
        }
    }
}

struct OpenSourceView: View {
    @State private var model = OpenSourceListModel()

    var body: some View {
        NavigationStack {
            LoadStateView(
                isLoading: model.isLoading,
                errorMessage: model.errorMessage,
                isEmpty: model.isEmpty,
                emptyMessage: "暂无开源关注",
                onRetry: { Task { await model.refresh() } }
            ) {
                List(model.entries) { entry in
                    NavigationLink(value: OpenSourceRoute.detail(entry.slug)) {
                        OpenSourceRow(entry: entry)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await model.refresh() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .background(Color.psSurface)
            .navigationDestination(for: OpenSourceRoute.self) { route in
                switch route {
                case .detail(let slug):
                    OpenSourceDetailView(slug: slug)
                case .directory(let slug, let path):
                    RepositoryDirectoryView(slug: slug, path: path)
                case .file(let slug, let path):
                    RepositoryFileView(slug: slug, path: path)
                }
            }
        }
        .task { await model.loadInitial() }
    }
}

private struct OpenSourceRow: View {
    let entry: OpenSourceListEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.repository)
                .font(.headline)
            if !entry.sourceSummary.isEmpty {
                Text(entry.sourceSummary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            HStack(spacing: 8) {
                Text(entry.category.label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(entry.status.rawValue)
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .overlay(Capsule().stroke(Color.secondary, lineWidth: 0.5))
                    .foregroundStyle(.secondary)
                Spacer()
            }
        }
        .padding(.vertical, 4)
    }
}

/// content jsonb 整行包装：详情直接取完整 content 解成 OpenSourceEntry。
private struct OpenSourceContentRow: Decodable {
    var content: OpenSourceEntry
}

/// 开源关注详情：分类/维度标签、摘要、判读、中文阅读版（Markdown），入口进仓库浏览。
struct OpenSourceDetailView: View {
    let slug: String

    @State private var entry: OpenSourceEntry?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let entry {
                detail(entry)
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
        .navigationTitle(slug)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func detail(_ entry: OpenSourceEntry) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(entry.repository)
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("\(entry.category.label) · \(entry.status.rawValue)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !entry.dimensions.isEmpty {
                    Text(entry.dimensions.map(\.label).joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !entry.sourceSummary.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("摘要")
                            .font(.headline)
                        Text(entry.sourceSummary)
                            .foregroundStyle(.secondary)
                    }
                }
                if !entry.personalNote.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("判读")
                            .font(.headline)
                        Text(entry.personalNote)
                            .foregroundStyle(.secondary)
                    }
                }
                if let parsedMarkdown = entry.parsedMarkdown, !parsedMarkdown.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("中文阅读版")
                            .font(.headline)
                        MarkdownText(markdown: parsedMarkdown)
                    }
                }
                NavigationLink(value: OpenSourceRoute.directory(slug: entry.slug, path: "")) {
                    Label("浏览仓库", systemImage: "folder")
                }
                .font(.headline)
                if let url = URL(string: entry.repositoryUrl) {
                    Link("在 GitHub 查看", destination: url)
                        .font(.subheadline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private func load() async {
        errorMessage = nil
        do {
            let row: OpenSourceContentRow = try await SupabaseClientProvider.shared
                .from("github_open_source_items")
                .select("content")
                .eq("slug", value: slug)
                .single()
                .execute()
                .value
            entry = row.content
        } catch {
            errorMessage = "读取开源关注详情失败，请稍后重试。"
        }
    }
}
