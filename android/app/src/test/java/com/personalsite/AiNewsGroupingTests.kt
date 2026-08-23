package com.personalsite

import com.personalsite.models.AiNewsGrouping
import com.personalsite.models.AiNewsCategory
import com.personalsite.models.AiNewsListItem
import org.junit.Assert.assertEquals
import org.junit.Test

/** 北京时间分组逻辑，对齐 lib/ai-news-types.ts 的 groupAiNewsByDay。 */
class AiNewsGroupingTests {
    private fun item(publishedAt: String?) = AiNewsListItem(
        category = "tip",
        id = java.util.UUID.randomUUID().toString(),
        publishedAt = publishedAt,
        selected = false,
        sourceName = "测试",
        summary = "",
        title = "",
    )

    @Test
    fun `dayKey按北京时间切日`() {
        // UTC 16:30 已是北京时间次日 00:30，应归入下一天。
        assertEquals("2026-08-22", AiNewsGrouping.dayKey("2026-08-21T16:30:00Z"))
        // UTC 15:30 仍是北京时间当天 23:30。
        assertEquals("2026-08-21", AiNewsGrouping.dayKey("2026-08-21T15:30:00Z"))
        // 带毫秒与小数秒的格式也要能解析。
        assertEquals("2026-08-22", AiNewsGrouping.dayKey("2026-08-21T16:30:00.123Z"))
        assertEquals("2026-08-22", AiNewsGrouping.dayKey("2026-08-21T16:30:00+00:00"))
        // 无发布时间与无法解析的串都归空 key。
        assertEquals("", AiNewsGrouping.dayKey(null))
        assertEquals("", AiNewsGrouping.dayKey("not-a-date"))
    }

    @Test
    fun `分组倒序且时间待定排最后`() {
        val items = listOf(
            item("2026-08-20T01:00:00Z"), // 北京 08-20 09:00
            item(null),
            item("2026-08-21T16:30:00Z"), // 北京 08-22 00:30
            item("2026-08-21T15:30:00Z"), // 北京 08-21 23:30
            item("2026-08-22T00:30:00Z"), // 北京 08-22 08:30
        )
        val groups = AiNewsGrouping.group(items) { it.publishedAt }

        assertEquals(listOf("2026-08-22", "2026-08-21", "2026-08-20", ""), groups.map { it.dayKey })
        assertEquals(listOf(2, 1, 1, 1), groups.map { it.items.size })
        // 组内保持传入顺序。
        assertEquals("2026-08-21T16:30:00Z", groups[0].items[0].publishedAt)
        // 「时间待定」组标签与空 weekday。
        assertEquals("时间待定", groups[3].label)
        assertEquals("", groups[3].weekday)
    }

    @Test
    fun `分组标签与中文星期`() {
        val groups = AiNewsGrouping.group(listOf(item("2026-08-21T16:30:00Z"))) { it.publishedAt }
        assertEquals(1, groups.size)
        assertEquals("8月22日", groups[0].label)
        // 2026-08-22 是星期六。
        assertEquals("星期六", groups[0].weekday)
    }

    @Test
    fun `分类标签与出现顺序`() {
        assertEquals("模型", AiNewsCategory.label("ai-models"))
        assertEquals("unknown", AiNewsCategory.label("unknown"))
        // 固定顺序优先，未知分类按 id 排序附后。
        val present = AiNewsCategory.presentCategories(listOf("tip", "zzz", "ai-models", "aaa"))
        assertEquals(listOf("ai-models", "tip", "aaa", "zzz"), present.map { it.first })
        assertEquals(listOf("模型", "教程", "aaa", "zzz"), present.map { it.second })
    }
}
