package com.personalsite.models

import com.personalsite.core.SSEEvent
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** 问一问模型，对齐 lib/ask-types.ts 与 app/api/ask/route.ts 的 SSE 事件。 */

@Serializable
enum class AskScope {
    @SerialName("all") ALL,
    @SerialName("ai-news") AI_NEWS,
    @SerialName("daily") DAILY,
    @SerialName("open-source") OPEN_SOURCE,
}

@Serializable
data class AskSource(
    val content: String,
    val id: String,
    val publishedAt: String? = null,
    val scope: AskScope,
    val section: String? = null,
    val sourceId: String,
    val sourceUrl: String,
    val title: String,
)

/** POST /api/ask 的请求体。visitorId 需过服务端正则 ^[A-Za-z0-9_-]{16,128}$。 */
@Serializable
data class AskRequestBody(
    val conversationId: String,
    val visitorId: String,
    val question: String,
    val scope: AskScope,
)

/** /api/ask SSE 事件的业务形态：payload 形状见 route.ts 的 sseEvent 调用点。 */
sealed class AskStreamEvent {
    data class Sources(val sources: List<AskSource>) : AskStreamEvent()
    data class Text(val delta: String) : AskStreamEvent()
    data object Done : AskStreamEvent()
    data class Error(val message: String) : AskStreamEvent()

    sealed class DecodeError(message: String) : Exception(message) {
        data class UnknownEvent(val eventName: String) : DecodeError("unknown event: $eventName")
        data class InvalidPayload(val payload: String) : DecodeError("invalid payload: $payload")
    }

    @Serializable
    private data class SourcesPayload(val sources: List<AskSource>)

    @Serializable
    private data class TextPayload(val delta: String)

    @Serializable
    private data class ErrorPayload(val message: String)

    companion object {
        private val json = Json { ignoreUnknownKeys = true }

        /** 从通用 SSE 事件映射；payload JSON 解析失败时抛错而不是静默丢弃。 */
        fun from(event: SSEEvent): AskStreamEvent = when (event.event) {
            "sources" -> Sources(
                runCatching { json.decodeFromString<SourcesPayload>(event.data) }
                    .getOrElse { throw DecodeError.InvalidPayload(event.data) }
                    .sources
            )
            "text" -> Text(
                runCatching { json.decodeFromString<TextPayload>(event.data) }
                    .getOrElse { throw DecodeError.InvalidPayload(event.data) }
                    .delta
            )
            "done" -> Done
            "error" -> Error(
                runCatching { json.decodeFromString<ErrorPayload>(event.data) }
                    .getOrElse { throw DecodeError.InvalidPayload(event.data) }
                    .message
            )
            else -> throw DecodeError.UnknownEvent(event.event)
        }
    }
}
