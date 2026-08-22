import Foundation
import Testing

@testable import PersonalSite

/// SSE 解析：全部用本地构造的行流，不依赖网络。
struct SSEStreamTests {
    /// 把一段原始 SSE 文本切成行流（模拟 URLSession.bytes 的 lines）。
    private func lineStream(_ raw: String) -> AsyncStream<String> {
        AsyncStream { continuation in
            for line in raw.split(separator: "\n", omittingEmptySubsequences: false) {
                continuation.yield(String(line))
            }
            continuation.finish()
        }
    }

    private func collect(_ raw: String) async throws -> [SSEEvent] {
        var events: [SSEEvent] = []
        for try await event in SSEStream.events(fromLines: lineStream(raw)) {
            events.append(event)
        }
        return events
    }

    @Test func 多行data用换行拼接() async throws {
        let events = try await collect("event: text\ndata: {\"delta\":\"你\"\ndata: \"好\"}\n\n")
        #expect(events == [SSEEvent(event: "text", data: "{\"delta\":\"你\"\n\"好\"}")])
    }

    @Test func 空行划分事件边界() async throws {
        let raw = "event: text\ndata: {\"delta\":\"a\"}\n\nevent: done\ndata: {}\n\n"
        let events = try await collect(raw)
        #expect(events == [
            SSEEvent(event: "text", data: "{\"delta\":\"a\"}"),
            SSEEvent(event: "done", data: "{}"),
        ])
    }

    @Test func 注释行与无event行() async throws {
        // 冒号开头的行是注释；未声明 event 的消息归为 message；data 与冒号间无空格也能解析。
        let raw = ": ping\ndata:{\"delta\":\"x\"}\n\n"
        let events = try await collect(raw)
        #expect(events == [SSEEvent(event: "message", data: "{\"delta\":\"x\"}")])
    }

    @Test func 空行不派发空事件() async throws {
        // 连续空行、只有 event 没有 data 的行都不产出事件。
        let raw = "\n\nevent: text\n\n"
        #expect(try await collect(raw).isEmpty)
    }

    @Test func 流结束冲刷未收尾的最后一个事件() async throws {
        let raw = "event: text\ndata: {\"delta\":\"尾\"}\n"
        let events = try await collect(raw)
        #expect(events == [SSEEvent(event: "text", data: "{\"delta\":\"尾\"}")])
    }

    @Test func 映射为问一问业务事件() async throws {
        let raw = """
        event: sources
        data: {"sources":[{"content":"摘录","id":"s1","publishedAt":null,"scope":"ai-news","section":null,"sourceId":"a1","sourceUrl":"https://example.com","title":"标题"}]}
        
        event: text
        data: {"delta":"答案片段"}
        
        event: done
        data: {}
        
        
        """
        let events = try await collect(raw).map(AskStreamEvent.init(event:))
        guard case .sources(let sources) = events[0] else {
            Issue.record("首个事件应为 sources，实为 \(events[0])")
            return
        }
        #expect(sources == [AskSource(
            content: "摘录", id: "s1", publishedAt: nil, scope: .aiNews,
            section: nil, sourceId: "a1", sourceUrl: "https://example.com", title: "标题"
        )])
        #expect(events[1] == .text("答案片段"))
        #expect(events[2] == .done)
    }

    @Test func 服务端error事件与未知事件() throws {
        #expect(try AskStreamEvent(event: SSEEvent(event: "error", data: "{\"message\":\"稍后再试\"}")) == .error("稍后再试"))
        #expect(throws: AskStreamEvent.DecodeError.unknownEvent("heartbeat")) {
            _ = try AskStreamEvent(event: SSEEvent(event: "heartbeat", data: "{}"))
        }
        #expect(throws: AskStreamEvent.DecodeError.invalidPayload("not json")) {
            _ = try AskStreamEvent(event: SSEEvent(event: "text", data: "not json"))
        }
    }
}
