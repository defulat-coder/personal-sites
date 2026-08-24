import AVKit
import SwiftUI

/// 策展详情：GET /api/curation/[id]，含 analysis（Markdown）、摘录、引用上下文与媒体。
struct CurationDetailView: View {
    let id: String

    @State private var item: CurationItem?
    @State private var errorMessage: String?

    private var stateIdentity: LoadStateIdentity {
        item != nil ? .content : errorMessage != nil ? .error : .loading
    }

    var body: some View {
        ZStack {
            Group {
            if let item {
                detail(item)
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
        .navigationTitle("策展详情")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func detail(_ item: CurationItem) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title)
                    .font(.title2)
                    .fontWeight(.semibold)
                HStack(spacing: 8) {
                    Text(item.source.platform == "x" ? "\(item.author.name) @\(item.author.handle)" : "抖音 · \(item.author.name)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let publishedAt = item.publishedAt {
                        Text(publishedAt.prefix(10))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if !item.tags.isEmpty {
                    Text(item.tags.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !item.media.isEmpty {
                    ForEach(item.media.indices, id: \.self) { index in
                        CurationMediaView(media: item.media[index])
                    }
                }

                if !item.text.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("来源摘录")
                            .font(.headline)
                        Text(item.text)
                            .foregroundStyle(.secondary)
                    }
                }

                if let quote = item.quoteContext {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("引用 \(quote.authorName) @\(quote.author)")
                            .font(.headline)
                        Text(quote.text)
                            .foregroundStyle(.secondary)
                    }
                }

                if !item.analysis.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("分析")
                            .font(.headline)
                        MarkdownText(markdown: item.analysis)
                    }
                }

                if let sourceURL = URL(string: item.source.url) {
                    Link("查看\(item.source.label)", destination: sourceURL)
                        .font(.headline)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
    }

    private func load() async {
        errorMessage = nil
        do {
            item = try await SiteAPIClient().get("/api/curation/\(id)")
        } catch {
            errorMessage = "读取策展详情失败，请稍后重试。"
        }
    }
}

/// 单个媒体：photo / animated_gif 走 AsyncImage；video 用 AVPlayer 经 /api/x-media 代理。
private struct CurationMediaView: View {
    let media: CurationMedia

    var body: some View {
        switch media.type {
        case .video:
            if let videoURL = media.videoUrl, let proxied = proxiedURL(videoURL) {
                VideoPlayer(player: AVPlayer(url: proxied))
                    .aspectRatio(aspectRatio, contentMode: .fit)
                    .clipShape(.rect(cornerRadius: 12))
            }
        case .photo, .animatedGif:
            if let url = URL(string: media.url) {
                AsyncImage(url: url) { phase in
                    ZStack {
                        Color(uiColor: .secondarySystemBackground)
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fit)
                                .transition(.opacity)
                        case .failure:
                            Label("图片加载失败", systemImage: "photo")
                                .foregroundStyle(.secondary)
                                .transition(.opacity)
                        default:
                            ProgressView()
                                .transition(.opacity)
                        }
                    }
                    .animation(PSMotion.stateChange, value: phaseIdentity(phase))
                }
                .aspectRatio(aspectRatio, contentMode: .fit)
                .clipShape(.rect(cornerRadius: 12))
            }
        }
    }

    private var aspectRatio: CGFloat {
        guard let width = media.width, let height = media.height, height > 0 else { return 16.0 / 9.0 }
        return CGFloat(width) / CGFloat(height)
    }

    private func phaseIdentity(_ phase: AsyncImagePhase) -> LoadStateIdentity {
        switch phase {
        case .success: .content
        case .failure: .error
        default: .loading
        }
    }

    private func proxiedURL(_ raw: String) -> URL? {
        var components = URLComponents(url: Config.siteBaseURL.appending(path: "api/x-media"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "url", value: raw)]
        return components?.url
    }
}
