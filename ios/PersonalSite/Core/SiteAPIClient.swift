import Foundation

/// 站点 Web API 的薄封装：GET JSON，以及 POST /api/ask 的 SSE 入口。
/// baseURL 来自 Config（本地开发指向 http://127.0.0.1:3000）。
struct SiteAPIClient: Sendable {
    var baseURL: URL = Config.siteBaseURL
    var session: URLSession = .shared

    enum APIError: Error, Equatable {
        case badStatus(Int)
        /// 限流：带服务端的 Retry-After（秒），可能没有。
        case rateLimited(retryAfterSeconds: Int?)
    }

    /// GET 一个 JSON 接口并解码；jsonb 外层行与 camelCase 内容的解码策略由具体模型承担。
    func get<T: Decodable>(_ path: String, queryItems: [URLQueryItem] = []) async throws -> T {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        var components = URLComponents(url: baseURL.appending(path: normalizedPath), resolvingAgainstBaseURL: false)
        if !queryItems.isEmpty { components?.queryItems = queryItems }
        guard let url = components?.url else { throw URLError(.badURL) }
        let (data, response) = try await session.data(from: url)
        try validate(response)
        return try JSONDecoder().decode(T.self, from: data)
    }

    /// POST /api/ask：返回原始 SSE 事件序列；事件到业务模型的映射见 AskStreamEvent。
    func askEvents(
        conversationId: String,
        visitorId: String,
        question: String,
        scope: AskScope
    ) async throws -> SSEEventSequence<AsyncLineSequence<URLSession.AsyncBytes>> {
        var request = URLRequest(url: baseURL.appending(path: "api/ask"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = try JSONEncoder().encode(AskRequestBody(
            conversationId: conversationId,
            visitorId: visitorId,
            question: question,
            scope: scope
        ))
        let (bytes, response) = try await session.bytes(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 429 {
            throw APIError.rateLimited(retryAfterSeconds: http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init))
        }
        try validate(response)
        return SSEStream.events(from: bytes)
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        guard (200..<300).contains(http.statusCode) else { throw APIError.badStatus(http.statusCode) }
    }
}
