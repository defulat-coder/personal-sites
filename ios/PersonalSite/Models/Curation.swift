import Foundation

/// 策展数据走 Web API（/api/curation），返回的 JSON 已是 camelCase，直接默认解码即可。
/// 字段对齐 lib/curation-types.ts。

struct CurationAuthor: Codable, Equatable, Sendable {
    var handle: String
    var name: String
}

struct CurationLink: Codable, Equatable, Sendable {
    var shortUrl: String?
    var type: String
    var url: String
}

struct CurationSource: Codable, Equatable, Sendable {
    var label: String
    var platform: String
    var url: String
}

enum CurationMediaType: String, Codable, Sendable {
    case photo
    case video
    case animatedGif = "animated_gif"
}

struct CurationMedia: Codable, Equatable, Sendable {
    var durationMs: Int?
    var height: Int?
    var previewUrl: String?
    var type: CurationMediaType
    var url: String
    var videoUrl: String?
    var width: Int?
}

struct CurationQuoteContext: Codable, Equatable, Sendable {
    var author: String
    var authorName: String
    var text: String
}

struct CurationItem: Codable, Equatable, Identifiable, Sendable {
    var analysis: String
    var author: CurationAuthor
    var collectedAt: String?
    var collectedOrder: Int?
    var id: String
    var links: [CurationLink]
    var media: [CurationMedia]
    var publishedAt: String?
    var quoteContext: CurationQuoteContext?
    var source: CurationSource
    var summary: String
    var tags: [String]
    var text: String
    var title: String
}

/// 列表项：full analysis 仅详情页；attachments 由服务端从 media/quoteContext 归并。
struct CurationListItem: Codable, Equatable, Identifiable, Sendable {
    var author: CurationAuthor
    var attachments: [String]
    var collectedAt: String?
    var id: String
    var publishedAt: String?
    var source: CurationSource
    var summary: String
    var tags: [String]
    var text: String
    var title: String
}

/// /api/curation 的分页响应（对齐 lib/curation.ts 的 CurationPage）。
struct CurationPage: Codable, Equatable, Sendable {
    var hasMore: Bool
    var items: [CurationListItem]
}
