package com.personalsite.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 策展数据走 Web API（/api/curation），返回的 JSON 已是 camelCase，直接默认解码即可。
 * 字段对齐 lib/curation-types.ts。
 */

@Serializable
data class CurationAuthor(
    val handle: String,
    val name: String,
)

@Serializable
data class CurationLink(
    val shortUrl: String? = null,
    val type: String,
    val url: String,
)

@Serializable
data class CurationSource(
    val label: String,
    val platform: String,
    val url: String,
)

@Serializable
enum class CurationMediaType {
    @SerialName("photo") PHOTO,
    @SerialName("video") VIDEO,
    @SerialName("animated_gif") ANIMATED_GIF,
}

@Serializable
data class CurationMedia(
    val durationMs: Long? = null,
    val height: Int? = null,
    val previewUrl: String? = null,
    val type: CurationMediaType,
    val url: String,
    val videoUrl: String? = null,
    val width: Int? = null,
)

@Serializable
data class CurationQuoteContext(
    val author: String,
    val authorName: String,
    val text: String,
)

@Serializable
data class CurationItem(
    val analysis: String,
    val author: CurationAuthor,
    val collectedAt: String? = null,
    val collectedOrder: Int? = null,
    val id: String,
    val links: List<CurationLink> = emptyList(),
    val media: List<CurationMedia> = emptyList(),
    val publishedAt: String? = null,
    val quoteContext: CurationQuoteContext? = null,
    val source: CurationSource,
    val summary: String,
    val tags: List<String> = emptyList(),
    val text: String,
    val title: String,
)

/** 列表项：full analysis 仅详情页；attachments 由服务端从 media/quoteContext 归并。 */
@Serializable
data class CurationListItem(
    val author: CurationAuthor,
    val attachments: List<String> = emptyList(),
    val collectedAt: String? = null,
    val id: String,
    val publishedAt: String? = null,
    val source: CurationSource,
    val summary: String,
    val tags: List<String> = emptyList(),
    val text: String,
    val title: String,
)

/** /api/curation 的分页响应（对齐 lib/curation.ts 的 CurationPage）。 */
@Serializable
data class CurationPage(
    val hasMore: Boolean,
    val items: List<CurationListItem>,
)
