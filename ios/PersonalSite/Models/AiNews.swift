import Foundation

/// 每日动态条目，字段对齐 lib/ai-news-types.ts 的 AiNewsItem。
struct AiNewsItem: Codable, Equatable, Identifiable, Sendable {
    var category: String
    var id: String
    var publishedAt: String?
    var reason: String
    var score: Double?
    var selected: Bool
    var sourceName: String
    var summary: String
    var title: String
    var url: String
}

/// 列表投影，对齐 AiNewsListItem：reason/score/url 仅详情使用。
struct AiNewsListItem: Codable, Equatable, Identifiable, Sendable {
    var category: String
    var id: String
    var publishedAt: String?
    var selected: Bool
    var sourceName: String
    var summary: String
    var title: String
}

/// ai_news_public_items 表行。外层列名是 snake_case，content jsonb 内是 camelCase，
/// 解码分两层：外层显式 CodingKeys，内层走默认策略（不能一把梭 convertFromSnakeCase）。
struct AiNewsPublicRow: Decodable, Sendable {
    var id: String
    var content: Content
    var selected: Bool
    var publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, content, selected
        case publishedAt = "published_at"
    }

    /// content jsonb 结构，与 Web 的 aiNewsItemContentSchema 一致。
    struct Content: Decodable, Sendable {
        var category: String
        var id: String
        var publishedAt: String?
        var reason: String
        var score: Double?
        var sourceName: String
        var summary: String
        var title: String
        var url: String
    }

    /// 对齐 Web 的 toAiNewsItem：content 平铺 + 行级 selected。
    var item: AiNewsItem {
        AiNewsItem(
            category: content.category,
            id: content.id,
            publishedAt: content.publishedAt,
            reason: content.reason,
            score: content.score,
            selected: selected,
            sourceName: content.sourceName,
            summary: content.summary,
            title: content.title,
            url: content.url
        )
    }
}

/// 分类标签与固定顺序，对齐 aiNewsCategoryLabels / aiNewsCategoryOrder。
enum AiNewsCategory {
    static let labels: [String: String] = [
        "ai-models": "模型",
        "ai-products": "产品",
        "industry": "行业",
        "paper": "论文",
        "tip": "教程",
    ]

    static let order = ["ai-models", "ai-products", "industry", "paper", "tip"]

    static func label(for category: String) -> String {
        labels[category] ?? category
    }

    /// 按固定分类顺序列出实际出现的分类，未知分类按 id 排序附后（对齐 listAiNewsCategories）。
    static func presentCategories(_ categories: [String]) -> [(id: String, label: String)] {
        let present = Set(categories.filter { !$0.isEmpty })
        let ordered = order.filter { present.contains($0) }
        let rest = present.filter { !order.contains($0) }.sorted()
        return (ordered + rest).map { (id: $0, label: label(for: $0)) }
    }
}

/// 按北京时间分组的结果，对齐 AiNewsDayGroup。
struct AiNewsDayGroup<Item>: Equatable where Item: Equatable {
    var dayKey: String
    var items: [Item]
    var label: String
    var weekday: String
}

/// 北京时间（Asia/Shanghai）按日分组逻辑，对齐 groupAiNewsByDay。
enum AiNewsGrouping {
    static let timeZone = TimeZone(identifier: "Asia/Shanghai")!

    /// 北京时间日期 key（YYYY-MM-DD）；无发布时间返回空串。
    static func dayKey(for publishedAt: String?) -> String {
        guard let publishedAt, let date = parseISODate(publishedAt) else { return "" }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = components.year, let month = components.month, let day = components.day else { return "" }
        return String(format: "%04d-%02d-%02d", year, month, day)
    }

    /// 按北京时间日期倒序分组；无发布时间的条目排在最后的「时间待定」组。
    /// 组内条目保持传入顺序（与 Web 的 Map 插入序一致）。
    static func group<Item: Equatable>(_ items: [Item], publishedAt: (Item) -> String?) -> [AiNewsDayGroup<Item>] {
        var grouped: [String: [Item]] = [:]
        for item in items {
            grouped[dayKey(for: publishedAt(item)), default: []].append(item)
        }
        return grouped.keys
            .sorted { a, b in
                if a.isEmpty { return false }
                if b.isEmpty { return true }
                return a > b
            }
            .map { key in
                AiNewsDayGroup(dayKey: key, items: grouped[key] ?? [], label: label(for: key), weekday: weekday(for: key))
            }
    }

    /// 「M月D日」，无发布时间时为「时间待定」。
    private static func label(for dayKey: String) -> String {
        guard !dayKey.isEmpty else { return "时间待定" }
        let month = Int(dayKey.dropFirst(5).prefix(2)) ?? 0
        let day = Int(dayKey.dropFirst(8).prefix(2)) ?? 0
        return "\(month)月\(day)日"
    }

    /// 中文星期（对齐 Web 的 weekday: long），以北京时间正午为准避免时区边界。
    private static func weekday(for dayKey: String) -> String {
        guard !dayKey.isEmpty, let date = parseISODate("\(dayKey)T12:00:00+08:00") else { return "" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh-Hans-CN")
        formatter.timeZone = timeZone
        formatter.dateFormat = "EEEE"
        return formatter.string(from: date)
    }

    /// 相对时间（对齐 formatAiNewsRelativeTime）：未来或无法解析返回 nil。
    static func relativeTime(for publishedAt: String?, now: Date = Date()) -> String? {
        guard let publishedAt, let date = parseISODate(publishedAt) else { return nil }
        let diff = now.timeIntervalSince(date)
        if diff.isNaN || diff < 0 { return nil }
        let minutes = Int(diff / 60)
        if minutes < 1 { return "刚刚" }
        if minutes < 60 { return "\(minutes)分钟前" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)小时前" }
        return "\(hours / 24)天前"
    }

    /// formatter 非 Sendable，每次现建，避免共享可变状态。
    private static func parseISODate(_ string: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: string) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: string)
    }
}
