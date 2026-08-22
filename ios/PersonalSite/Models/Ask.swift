import Foundation

/// 问一问模型，对齐 lib/ask-types.ts 与 app/api/ask/route.ts 的 SSE 事件。

enum AskScope: String, Codable, CaseIterable, Sendable {
    case all
    case aiNews = "ai-news"
    case daily
    case openSource = "open-source"
}

struct AskSource: Codable, Equatable, Identifiable, Sendable {
    var content: String
    var id: String
    var publishedAt: String?
    var scope: AskScope
    var section: String?
    var sourceId: String
    var sourceUrl: String
    var title: String
}

/// POST /api/ask 的请求体。visitorId 需过服务端正则 ^[A-Za-z0-9_-]{16,128}$。
struct AskRequestBody: Encodable, Sendable {
    var conversationId: String
    var visitorId: String
    var question: String
    var scope: AskScope
}

/// /api/ask SSE 事件的业务形态：payload 形状见 route.ts 的 sseEvent 调用点。
enum AskStreamEvent: Equatable, Sendable {
    case sources([AskSource])
    case text(String)
    case done
    case error(String)

    enum DecodeError: Error, Equatable {
        case unknownEvent(String)
        case invalidPayload(String)
    }

    private struct SourcesPayload: Decodable { var sources: [AskSource] }
    private struct TextPayload: Decodable { var delta: String }
    private struct ErrorPayload: Decodable { var message: String }

    /// 从通用 SSE 事件映射；payload JSON 解析失败时抛错而不是静默丢弃。
    init(event: SSEEvent) throws {
        let data = Data(event.data.utf8)
        switch event.event {
        case "sources":
            guard let payload = try? JSONDecoder().decode(SourcesPayload.self, from: data) else {
                throw DecodeError.invalidPayload(event.data)
            }
            self = .sources(payload.sources)
        case "text":
            guard let payload = try? JSONDecoder().decode(TextPayload.self, from: data) else {
                throw DecodeError.invalidPayload(event.data)
            }
            self = .text(payload.delta)
        case "done":
            self = .done
        case "error":
            guard let payload = try? JSONDecoder().decode(ErrorPayload.self, from: data) else {
                throw DecodeError.invalidPayload(event.data)
            }
            self = .error(payload.message)
        default:
            throw DecodeError.unknownEvent(event.event)
        }
    }
}
