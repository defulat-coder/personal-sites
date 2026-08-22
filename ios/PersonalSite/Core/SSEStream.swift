import Foundation

/// 一条 SSE 消息：事件名 + 已按 SSE 规则用换行拼接的数据体。
/// 未显式声明 event 的消息按规范归为 "message"。
struct SSEEvent: Equatable, Sendable {
    var event: String
    var data: String
}

/// 逐行解析 SSE：data 多行拼接、空行派发、冒号开头的行视为注释。
struct SSEParser {
    private var event = "message"
    private var dataLines: [String] = []
    private var hasData = false

    /// 喂入一行（不含换行符）；一个事件结束时返回它。
    mutating func process(line: String) -> SSEEvent? {
        if line.hasPrefix(":") { return nil }
        if line.isEmpty { return dispatch() }
        let (field, value) = Self.splitField(line)
        switch field {
        case "event": event = value
        case "data":
            dataLines.append(value)
            hasData = true
        default: break
        }
        return nil
    }

    /// 流结束时冲刷未以空行收尾的最后一个事件。
    mutating func finish() -> SSEEvent? {
        dispatch()
    }

    private mutating func dispatch() -> SSEEvent? {
        defer {
            event = "message"
            dataLines = []
            hasData = false
        }
        guard hasData else { return nil }
        return SSEEvent(event: event, data: dataLines.joined(separator: "\n"))
    }

    /// 规范：字段与值以首个冒号分隔，值前若有单个空格则剥掉；无冒号则整行是字段名。
    private static func splitField(_ line: String) -> (String, String) {
        guard let colon = line.firstIndex(of: ":") else { return (line, "") }
        var value = line[line.index(after: colon)...]
        if value.hasPrefix(" ") { value = value.dropFirst() }
        return (String(line[..<colon]), String(value))
    }
}

/// 把行序列转成 SSE 事件序列。自定义 AsyncSequence：不额外起 Task，规避跨 actor 的 Sendable 约束。
struct SSEEventSequence<Base: AsyncSequence>: AsyncSequence where Base.Element == String {
    typealias Element = SSEEvent

    let base: Base

    struct AsyncIterator: AsyncIteratorProtocol {
        var iterator: Base.AsyncIterator
        var parser = SSEParser()

        mutating func next() async throws -> SSEEvent? {
            while let line = try await iterator.next() {
                if let event = parser.process(line: line) { return event }
            }
            return parser.finish()
        }
    }

    func makeAsyncIterator() -> AsyncIterator {
        AsyncIterator(iterator: base.makeAsyncIterator())
    }
}

enum SSEStream {
    /// 把 URLSession 的字节流解析成 SSE 事件序列。
    static func events(from bytes: URLSession.AsyncBytes) -> SSEEventSequence<AsyncLineSequence<URLSession.AsyncBytes>> {
        SSEEventSequence(base: bytes.lines)
    }

    /// 把任意行序列解析成 SSE 事件序列（测试可直接喂本地构造的行）。
    static func events<S: AsyncSequence>(fromLines lines: S) -> SSEEventSequence<S> where S.Element == String {
        SSEEventSequence(base: lines)
    }
}
