package com.personalsite.core

import com.personalsite.models.AskRequestBody
import com.personalsite.models.AskScope
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * 站点 Web API 的薄封装：GET JSON，以及 POST /api/ask 的 SSE 入口。
 * baseUrl 来自 Config（模拟器本地开发指向 http://10.0.2.2:3000）。
 */
class SiteApiClient(
    private val baseUrl: String = Config.siteBaseUrl,
    private val client: OkHttpClient = sharedClient,
) {
    sealed class ApiError : IOException() {
        data class BadStatus(val status: Int) : ApiError()
        /** 限流：带服务端的 Retry-After（秒），可能没有。 */
        data class RateLimited(val retryAfterSeconds: Int?) : ApiError()
    }

    /** GET 一个 JSON 接口并解码；外层行与 camelCase 内容的解码策略由具体模型承担。 */
    suspend inline fun <reified T> get(path: String, query: Map<String, String> = emptyMap()): T {
        val url = buildUrl(path, query)
        val request = Request.Builder().url(url).get().build()
        val body = execute(request).use { it.body.string() }
        return json.decodeFromString(body)
    }

    /** POST /api/ask：返回 SSE 事件流；事件到业务模型的映射见 AskStreamEvent。 */
    fun askEvents(
        conversationId: String,
        visitorId: String,
        question: String,
        scope: AskScope,
    ): Flow<SSEEvent> = flow {
        val payload = json.encodeToString(
            AskRequestBody(
                conversationId = conversationId,
                visitorId = visitorId,
                question = question,
                scope = scope,
            )
        )
        val request = Request.Builder()
            .url(buildUrl("/api/ask"))
            .post(payload.toRequestBody("application/json".toMediaType()))
            .header("Accept", "text/event-stream")
            .build()
        execute(request).use { response ->
            val source = response.body.source()
            val parser = SSEParser()
            while (true) {
                val line = source.readUtf8Line() ?: break
                parser.process(line)?.let { emit(it) }
            }
            parser.finish()?.let { emit(it) }
        }
    }.flowOn(Dispatchers.IO)

    fun buildUrl(path: String, query: Map<String, String> = emptyMap()): HttpUrl {
        val normalized = path.removePrefix("/")
        val builder = "$baseUrl/$normalized".toHttpUrl().newBuilder()
        query.forEach { (name, value) -> builder.addQueryParameter(name, value) }
        return builder.build()
    }

    @PublishedApi
    internal fun execute(request: Request): okhttp3.Response {
        val response = client.newCall(request).execute()
        if (response.code == 429) {
            val retryAfter = response.header("Retry-After")?.toIntOrNull()
            response.close()
            throw ApiError.RateLimited(retryAfter)
        }
        if (response.code !in 200..299) {
            val status = response.code
            response.close()
            throw ApiError.BadStatus(status)
        }
        return response
    }

    companion object {
        val json = Json { ignoreUnknownKeys = true }

        /** 单例 OkHttpClient：连接池复用；SSE 长连接不设读超时。 */
        val sharedClient: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
                .build()
        }
    }
}
