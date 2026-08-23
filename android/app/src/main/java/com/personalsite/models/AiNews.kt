package com.personalsite.models

import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeParseException
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** 每日动态条目，字段对齐 lib/ai-news-types.ts 的 AiNewsItem。 */
@Serializable
data class AiNewsItem(
    val category: String,
    val id: String,
    val publishedAt: String? = null,
    val reason: String,
    val score: Double? = null,
    val selected: Boolean,
    val sourceName: String,
    val summary: String,
    val title: String,
    val url: String,
)

/** 列表投影，对齐 AiNewsListItem：reason/score/url 仅详情使用。 */
@Serializable
data class AiNewsListItem(
    val category: String,
    val id: String,
    val publishedAt: String? = null,
    val selected: Boolean,
    val sourceName: String,
    val summary: String,
    val title: String,
)

/**
 * ai_news_public_items 表行。外层列名是 snake_case，content jsonb 内是 camelCase，
 * 解码分两层：外层显式 SerialName，内层走默认策略（不能一把梭 snake_case 命名策略）。
 */
@Serializable
data class AiNewsPublicRow(
    val id: String,
    val content: Content,
    val selected: Boolean,
    @SerialName("published_at") val publishedAt: String? = null,
) {
    /** content jsonb 结构，与 Web 的 aiNewsItemContentSchema 一致。 */
    @Serializable
    data class Content(
        val category: String,
        val id: String,
        val publishedAt: String? = null,
        val reason: String,
        val score: Double? = null,
        val sourceName: String,
        val summary: String,
        val title: String,
        val url: String,
    )

    /** 对齐 Web 的 toAiNewsItem：content 平铺 + 行级 selected。 */
    val item: AiNewsItem
        get() = AiNewsItem(
            category = content.category,
            id = content.id,
            publishedAt = content.publishedAt,
            reason = content.reason,
            score = content.score,
            selected = selected,
            sourceName = content.sourceName,
            summary = content.summary,
            title = content.title,
            url = content.url,
        )
}

/** 分类标签与固定顺序，对齐 aiNewsCategoryLabels / aiNewsCategoryOrder。 */
object AiNewsCategory {
    val labels = mapOf(
        "ai-models" to "模型",
        "ai-products" to "产品",
        "industry" to "行业",
        "paper" to "论文",
        "tip" to "教程",
    )

    val order = listOf("ai-models", "ai-products", "industry", "paper", "tip")

    fun label(category: String): String = labels[category] ?: category

    /** 按固定分类顺序列出实际出现的分类，未知分类按 id 排序附后（对齐 listAiNewsCategories）。 */
    fun presentCategories(categories: List<String>): List<Pair<String, String>> {
        val present = categories.filter { it.isNotEmpty() }.toSet()
        val ordered = order.filter { it in present }
        val rest = present.filter { it !in order }.sorted()
        return (ordered + rest).map { it to label(it) }
    }
}

/** 按北京时间分组的结果，对齐 AiNewsDayGroup。 */
data class AiNewsDayGroup<T>(
    val dayKey: String,
    val items: List<T>,
    val label: String,
    val weekday: String,
)

/** 北京时间（Asia/Shanghai）按日分组逻辑，对齐 groupAiNewsByDay。 */
object AiNewsGrouping {
    val zone: ZoneId = ZoneId.of("Asia/Shanghai")

    /** 北京时间日期 key（YYYY-MM-DD）；无发布时间返回空串。 */
    fun dayKey(publishedAt: String?): String {
        val instant = parseISODate(publishedAt) ?: return ""
        val date = instant.atZone(zone).toLocalDate()
        return "%04d-%02d-%02d".format(date.year, date.monthValue, date.dayOfMonth)
    }

    /**
     * 按北京时间日期倒序分组；无发布时间的条目排在最后的「时间待定」组。
     * 组内条目保持传入顺序（与 Web 的 Map 插入序一致）。
     */
    fun <T> group(items: List<T>, publishedAt: (T) -> String?): List<AiNewsDayGroup<T>> {
        val grouped = LinkedHashMap<String, MutableList<T>>()
        for (item in items) {
            grouped.getOrPut(dayKey(publishedAt(item))) { mutableListOf() }.add(item)
        }
        return grouped.keys
            .sortedWith { a, b ->
                when {
                    a.isEmpty() -> 1
                    b.isEmpty() -> -1
                    else -> b.compareTo(a)
                }
            }
            .map { key ->
                AiNewsDayGroup(
                    dayKey = key,
                    items = grouped[key].orEmpty(),
                    label = labelFor(key),
                    weekday = weekdayFor(key),
                )
            }
    }

    /** 「M月D日」，无发布时间时为「时间待定」。 */
    private fun labelFor(dayKey: String): String {
        if (dayKey.isEmpty()) return "时间待定"
        val month = dayKey.substring(5, 7).toIntOrNull() ?: 0
        val day = dayKey.substring(8, 10).toIntOrNull() ?: 0
        return "${month}月${day}日"
    }

    /** 中文星期（对齐 Web 的 weekday: long），以北京时间正午为准避免时区边界。 */
    private fun weekdayFor(dayKey: String): String {
        if (dayKey.isEmpty()) return ""
        val date = try {
            java.time.LocalDate.parse(dayKey)
        } catch (_: DateTimeParseException) {
            return ""
        }
        return when (date.dayOfWeek) {
            DayOfWeek.MONDAY -> "星期一"
            DayOfWeek.TUESDAY -> "星期二"
            DayOfWeek.WEDNESDAY -> "星期三"
            DayOfWeek.THURSDAY -> "星期四"
            DayOfWeek.FRIDAY -> "星期五"
            DayOfWeek.SATURDAY -> "星期六"
            DayOfWeek.SUNDAY -> "星期日"
        }
    }

    /** 相对时间（对齐 formatAiNewsRelativeTime）：未来或无法解析返回 null。 */
    fun relativeTime(publishedAt: String?, now: Instant = Instant.now()): String? {
        val instant = parseISODate(publishedAt) ?: return null
        val diffSeconds = now.epochSecond - instant.epochSecond
        if (diffSeconds < 0) return null
        val minutes = diffSeconds / 60
        if (minutes < 1) return "刚刚"
        if (minutes < 60) return "${minutes}分钟前"
        val hours = minutes / 60
        if (hours < 24) return "${hours}小时前"
        return "${hours / 24}天前"
    }

    /** 兼容带小数秒与不带小数秒的 ISO8601。 */
    private fun parseISODate(string: String?): Instant? {
        if (string == null) return null
        return try {
            Instant.parse(string)
        } catch (_: DateTimeParseException) {
            try {
                java.time.OffsetDateTime.parse(string).toInstant()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }
}
