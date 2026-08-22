import Foundation
import Testing

@testable import PersonalSite

/// 北京时间分组逻辑，对齐 lib/ai-news-types.ts 的 groupAiNewsByDay。
struct AiNewsGroupingTests {
    private func item(_ publishedAt: String?) -> AiNewsListItem {
        AiNewsListItem(
            category: "tip",
            id: UUID().uuidString,
            publishedAt: publishedAt,
            selected: false,
            sourceName: "测试",
            summary: "",
            title: ""
        )
    }

    @Test func dayKey按北京时间切日() {
        // UTC 16:30 已是北京时间次日 00:30，应归入下一天。
        #expect(AiNewsGrouping.dayKey(for: "2026-08-21T16:30:00Z") == "2026-08-22")
        // UTC 15:30 仍是北京时间当天 23:30。
        #expect(AiNewsGrouping.dayKey(for: "2026-08-21T15:30:00Z") == "2026-08-21")
        // 带毫秒与小数秒的格式也要能解析。
        #expect(AiNewsGrouping.dayKey(for: "2026-08-21T16:30:00.123Z") == "2026-08-22")
        #expect(AiNewsGrouping.dayKey(for: "2026-08-21T16:30:00+00:00") == "2026-08-22")
        // 无发布时间与无法解析的串都归空 key。
        #expect(AiNewsGrouping.dayKey(for: nil) == "")
        #expect(AiNewsGrouping.dayKey(for: "not-a-date") == "")
    }

    @Test func 分组倒序且时间待定排最后() {
        let items = [
            item("2026-08-20T01:00:00Z"), // 北京 08-20 09:00
            item(nil),
            item("2026-08-21T16:30:00Z"), // 北京 08-22 00:30
            item("2026-08-21T15:30:00Z"), // 北京 08-21 23:30
            item("2026-08-22T00:30:00Z"), // 北京 08-22 08:30
        ]
        let groups = AiNewsGrouping.group(items) { $0.publishedAt }

        #expect(groups.map(\.dayKey) == ["2026-08-22", "2026-08-21", "2026-08-20", ""])
        #expect(groups.map(\.items.count) == [2, 1, 1, 1])
        // 组内保持传入顺序。
        #expect(groups[0].items[0].publishedAt == "2026-08-21T16:30:00Z")
        // 「时间待定」组标签与空 weekday。
        #expect(groups[3].label == "时间待定")
        #expect(groups[3].weekday == "")
    }

    @Test func 分组标签与中文星期() {
        let groups = AiNewsGrouping.group([item("2026-08-21T16:30:00Z")]) { $0.publishedAt }
        #expect(groups.count == 1)
        #expect(groups[0].label == "8月22日")
        // 2026-08-22 是星期六。
        #expect(groups[0].weekday == "星期六")
    }

    @Test func 分类标签与出现顺序() {
        #expect(AiNewsCategory.label(for: "ai-models") == "模型")
        #expect(AiNewsCategory.label(for: "unknown") == "unknown")
        // 固定顺序优先，未知分类按 id 排序附后。
        let present = AiNewsCategory.presentCategories(["tip", "zzz", "ai-models", "aaa"])
        #expect(present.map(\.id) == ["ai-models", "tip", "aaa", "zzz"])
        #expect(present.map(\.label) == ["模型", "教程", "aaa", "zzz"])
    }
}
