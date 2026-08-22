import SwiftUI

/// 作品档案：直连 project_public_snapshots，snapshot jsonb 平铺成 Work（对齐 lib/works.ts 的 toWork）。
@MainActor
@Observable
final class WorksListModel {
    private(set) var works: [Work] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    var isEmpty: Bool { works.isEmpty }

    func loadInitial() async {
        guard works.isEmpty, !isLoading else { return }
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
            // 与 Web 端同排序：display_order 升序，再按 published_at 倒序。
            let rows: [WorkPublicRow] = try await SupabaseClientProvider.shared
                .from("project_public_snapshots")
                .select("display_order,published_at,snapshot")
                .order("display_order", ascending: true)
                .order("published_at", ascending: false)
                .execute()
                .value
            works = rows.map(Work.init(row:))
        } catch {
            errorMessage = "读取构建档案失败，请检查网络后重试。"
        }
    }
}

struct WorksView: View {
    @State private var model = WorksListModel()

    var body: some View {
        NavigationStack {
            LoadStateView(
                isLoading: model.isLoading,
                errorMessage: model.errorMessage,
                isEmpty: model.isEmpty,
                emptyMessage: "暂无构建档案",
                onRetry: { Task { await model.refresh() } }
            ) {
                List(model.works) { work in
                    NavigationLink(value: work) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(work.title)
                                .font(.headline)
                            Text(work.summary)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                            Text("\(work.period) · \(work.status)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .refreshable { await model.refresh() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .background(Color.psSurface)
            .navigationDestination(for: Work.self) { work in
                WorkDetailView(work: work)
            }
        }
        .task { await model.loadInitial() }
    }
}

private struct WorkDetailView: View {
    let work: Work

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(work.title)
                    .font(.title2)
                    .fontWeight(.semibold)
                Text("\(work.role) · \(work.period) · \(work.status)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !work.stack.isEmpty {
                    Text(work.stack.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if !work.currentFocus.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("当前关注")
                            .font(.headline)
                        Text(work.currentFocus)
                            .foregroundStyle(.secondary)
                    }
                }
                if !work.body.isEmpty {
                    MarkdownText(markdown: work.body)
                } else if !work.summary.isEmpty {
                    Text(work.summary)
                        .foregroundStyle(.secondary)
                }

                // 截图：站点相对路径拼 siteBaseURL。
                ForEach(work.shots, id: \.src) { shot in
                    if let url = shotURL(shot.src) {
                        VStack(alignment: .leading, spacing: 4) {
                            AsyncImage(url: url) { phase in
                                ZStack {
                                    Color(uiColor: .secondarySystemBackground)
                                    if case .success(let image) = phase {
                                        image.resizable().aspectRatio(contentMode: .fit)
                                            .transition(.opacity)
                                    } else if case .failure = phase {
                                        Label("图片加载失败", systemImage: "photo")
                                            .foregroundStyle(.secondary)
                                            .transition(.opacity)
                                    } else {
                                        ProgressView()
                                            .transition(.opacity)
                                    }
                                }
                                .animation(PSMotion.stateChange, value: workShotPhaseIdentity(phase))
                            }
                            .aspectRatio(16.0 / 9.0, contentMode: .fit)
                            .clipShape(.rect(cornerRadius: 12))
                            Text(shot.label)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if !work.records.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("记录")
                            .font(.headline)
                        ForEach(work.records) { record in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 8) {
                                    Text(record.kind.label)
                                        .font(.caption)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .overlay(Capsule().stroke(Color.secondary, lineWidth: 0.5))
                                        .foregroundStyle(.secondary)
                                    if let occurredAt = record.occurredAt {
                                        Text(occurredAt)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Text(record.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                if !record.summary.isEmpty {
                                    Text(record.summary)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle(work.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func shotURL(_ src: String) -> URL? {
        if src.hasPrefix("/") {
            return URL(string: src, relativeTo: Config.siteBaseURL)?.absoluteURL
        }
        return URL(string: src)
    }

    private func workShotPhaseIdentity(_ phase: AsyncImagePhase) -> LoadStateIdentity {
        switch phase {
        case .success: .content
        case .failure: .error
        default: .loading
        }
    }
}
