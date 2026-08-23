package com.personalsite.core

import com.personalsite.models.AskScope
import com.personalsite.models.AskSource
import com.personalsite.models.AskStreamEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** SSE 解析：全部用本地构造的行流，不依赖网络。 */
class SSEStreamTests {
    private fun collect(raw: String): List<SSEEvent> =
        SSEStream.events(raw.split("\n").asSequence()).toList()

    @Test
    fun `多行data用换行拼接`() {
        val events = collect("event: text\ndata: {\"delta\":\"你\"\ndata: \"好\"}\n\n")
        assertEquals(listOf(SSEEvent("text", "{\"delta\":\"你\"\n\"好\"}")), events)
    }

    @Test
    fun `空行划分事件边界`() {
        val events = collect("event: text\ndata: {\"delta\":\"a\"}\n\nevent: done\ndata: {}\n\n")
        assertEquals(
            listOf(SSEEvent("text", "{\"delta\":\"a\"}"), SSEEvent("done", "{}")),
            events,
        )
    }

    @Test
    fun `注释行与无event行`() {
        // 冒号开头的行是注释；未声明 event 的消息归为 message；data 与冒号间无空格也能解析。
        val events = collect(": ping\ndata:{\"delta\":\"x\"}\n\n")
        assertEquals(listOf(SSEEvent("message", "{\"delta\":\"x\"}")), events)
    }

    @Test
    fun `空行不派发空事件`() {
        // 连续空行、只有 event 没有 data 的行都不产出事件。
        assertTrue(collect("\n\nevent: text\n\n").isEmpty())
    }

    @Test
    fun `流结束冲刷未收尾的最后一个事件`() {
        val events = collect("event: text\ndata: {\"delta\":\"尾\"}\n")
        assertEquals(listOf(SSEEvent("text", "{\"delta\":\"尾\"}")), events)
    }

    @Test
    fun `映射为问一问业务事件`() {
        val raw = """
event: sources
data: {"sources":[{"content":"摘录","id":"s1","publishedAt":null,"scope":"ai-news","section":null,"sourceId":"a1","sourceUrl":"https://example.com","title":"标题"}]}

event: text
data: {"delta":"答案片段"}

event: done
data: {}


"""
        val events = collect(raw).map(AskStreamEvent::from)
        val first = events[0]
        assertTrue(first is AskStreamEvent.Sources)
        assertEquals(
            listOf(
                AskSource(
                    content = "摘录", id = "s1", publishedAt = null, scope = AskScope.AI_NEWS,
                    section = null, sourceId = "a1", sourceUrl = "https://example.com", title = "标题",
                )
            ),
            (first as AskStreamEvent.Sources).sources,
        )
        assertEquals(AskStreamEvent.Text("答案片段"), events[1])
        assertEquals(AskStreamEvent.Done, events[2])
    }

    @Test
    fun `服务端error事件与未知事件`() {
        assertEquals(
            AskStreamEvent.Error("稍后再试"),
            AskStreamEvent.from(SSEEvent("error", "{\"message\":\"稍后再试\"}")),
        )
        assertThrows(AskStreamEvent.DecodeError.UnknownEvent::class.java) {
            AskStreamEvent.from(SSEEvent("heartbeat", "{}"))
        }
        assertThrows(AskStreamEvent.DecodeError.InvalidPayload::class.java) {
            AskStreamEvent.from(SSEEvent("text", "not json"))
        }
    }
}
