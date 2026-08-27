import SwiftUI

/// 作品档案：经站点 API 读取随部署打包的本地 SQLite 投影。
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
            works = try await SiteAPIClient().get("/api/works")
        } catch {
            errorMessage = "读取构建档案失败，请检查网络后重试。"
        }
    }
}

struct WorksView: View {
    @State private var model = WorksListModel()
    var headerCollapsed: Binding<Bool>?

    private let scrollSpace = "works-list-scroll"

    init(headerCollapsed: Binding<Bool>? = nil) {
        self.headerCollapsed = headerCollapsed
    }

    var body: some View {
        NavigationStack {
            LoadStateView(
                isLoading: model.isLoading,
                errorMessage: model.errorMessage,
                isEmpty: model.isEmpty,
                emptyMessage: "暂无构建档案",
                onRetry: { Task { await model.refresh() } }
            ) {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        if let headerCollapsed {
                            ScrollCollapseSensor(
                                coordinateSpace: scrollSpace,
                                isCollapsed: headerCollapsed
                            )
                        }
                        ForEach(model.works) { work in
                            NavigationLink(value: work) {
                                WorkArchiveRow(work: work)
                            }
                            .buttonStyle(PSPressButtonStyle())

                            if work.id != model.works.last?.id {
                                Rectangle()
                                    .fill(Color.psLine)
                                    .frame(height: 0.5)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
                .coordinateSpace(.named(scrollSpace))
                .trackHeaderCollapse(headerCollapsed)
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

private struct WorkArchiveRow: View {
    let work: Work

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            ContentListMetadataLine(items: [work.period, work.status])

            Text(work.title)
                .font(.system(size: 19, weight: .semibold))
                .tracking(-0.018 * 19)
                .foregroundStyle(Color.psInk)

            Text(work.summary)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.psQuiet)
                .lineSpacing(2.5)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, minHeight: 142, alignment: .topLeading)
        .padding(.vertical, 18)
        .contentShape(.rect)
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
