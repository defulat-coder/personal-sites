import SwiftUI

/// 仓库目录页：经 /api/open-source/[slug]/repository/tree 拉全量树（服务端有缓存），
/// 每层按路径前缀过滤出直接子项，目录在前。
struct RepositoryDirectoryView: View {
    let slug: String
    let path: String

    @State private var entries: [RepositoryTreeEntry] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var truncated = false

    var body: some View {
        LoadStateView(
            isLoading: isLoading,
            errorMessage: errorMessage,
            isEmpty: children.isEmpty,
            emptyMessage: "目录为空",
            onRetry: { Task { await load() } }
        ) {
            List {
                if truncated {
                    Text("仓库较大，仅展示部分条目")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ForEach(children, id: \.path) { entry in
                    if entry.type == .tree {
                        NavigationLink(value: OpenSourceRoute.directory(slug: slug, path: entry.path)) {
                            Label(entry.name, systemImage: "folder")
                        }
                    } else {
                        NavigationLink(value: OpenSourceRoute.file(slug: slug, path: entry.path)) {
                            HStack {
                                Label(entry.name, systemImage: "doc.text")
                                Spacer()
                                if let size = entry.size {
                                    Text(Self.sizeText(size))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle(path.isEmpty ? "仓库" : path.split(separator: "/").last.map(String.init) ?? path)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    /// 直接子项：路径以当前目录为前缀且剩余部分不含 "/"。
    private var children: [RepositoryTreeEntry] {
        let prefix = path.isEmpty ? "" : path + "/"
        return entries
            .filter { entry in
                guard entry.path.hasPrefix(prefix) else { return false }
                return !entry.path.dropFirst(prefix.count).contains("/")
            }
            .sorted { left, right in
                if (left.type == .tree) != (right.type == .tree) { return left.type == .tree }
                return left.name.localizedStandardCompare(right.name) == .orderedAscending
            }
    }

    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let tree: RepositoryTreeResponse = try await SiteAPIClient().get("/api/open-source/\(slug)/repository/tree")
            entries = tree.entries
            truncated = tree.truncated
        } catch {
            errorMessage = "读取仓库目录失败，请稍后重试。"
        }
    }

    private static func sizeText(_ bytes: Int) -> String {
        if bytes < 1024 { return "\(bytes) B" }
        return String(format: "%.1f KB", Double(bytes) / 1024.0)
    }
}

private extension RepositoryTreeEntry {
    var name: String {
        path.split(separator: "/").last.map(String.init) ?? path
    }
}

/// 仓库文件页：文本内容等宽展示；二进制给 GitHub 原文件链接。
struct RepositoryFileView: View {
    let slug: String
    let path: String

    @State private var file: RepositoryFileResponse?
    @State private var errorMessage: String?

    private var stateIdentity: LoadStateIdentity {
        file != nil ? .content : errorMessage != nil ? .error : .loading
    }

    var body: some View {
        ZStack {
            Group {
            if let file {
                if file.binary {
                    ContentUnavailableView {
                        Label("二进制文件，无法预览", systemImage: "doc")
                    } actions: {
                        if let url = URL(string: file.fileUrl) {
                            Link("在 GitHub 查看", destination: url)
                        }
                    }
                } else {
                    ScrollView([.vertical, .horizontal]) {
                        Text(file.content ?? "")
                            .font(.system(.footnote, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    }
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
            .id(stateIdentity)
            .transition(.opacity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .animation(PSMotion.stateChange, value: stateIdentity)
        .navigationTitle(path.split(separator: "/").last.map(String.init) ?? path)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        errorMessage = nil
        do {
            file = try await SiteAPIClient().get(
                "/api/open-source/\(slug)/repository/file",
                queryItems: [URLQueryItem(name: "path", value: path)]
            )
        } catch {
            errorMessage = "读取文件失败，请稍后重试。"
        }
    }
}
