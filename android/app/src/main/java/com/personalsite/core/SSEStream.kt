package com.personalsite.core

/**
 * 一条 SSE 消息：事件名 + 已按 SSE 规则用换行拼接的数据体。
 * 未显式声明 event 的消息按规范归为 "message"。
 */
data class SSEEvent(val event: String, val data: String)

/**
 * 逐行解析 SSE：data 多行拼接、空行派发、冒号开头的行视为注释。
 * 与 iOS 的 SSEParser 一一对应。
 */
class SSEParser {
    private var event = "message"
    private val dataLines = mutableListOf<String>()
    private var hasData = false

    /** 喂入一行（不含换行符）；一个事件结束时返回它。 */
    fun process(line: String): SSEEvent? {
        if (line.startsWith(":")) return null
        if (line.isEmpty()) return dispatch()
        val (field, value) = splitField(line)
        when (field) {
            "event" -> event = value
            "data" -> {
                dataLines.add(value)
                hasData = true
            }
        }
        return null
    }

    /** 流结束时冲刷未以空行收尾的最后一个事件。 */
    fun finish(): SSEEvent? = dispatch()

    private fun dispatch(): SSEEvent? {
        val result = if (hasData) SSEEvent(event, dataLines.joinToString("\n")) else null
        event = "message"
        dataLines.clear()
        hasData = false
        return result
    }

    companion object {
        /** 规范：字段与值以首个冒号分隔，值前若有单个空格则剥掉；无冒号则整行是字段名。 */
        internal fun splitField(line: String): Pair<String, String> {
            val colon = line.indexOf(':')
            if (colon < 0) return line to ""
            var value = line.substring(colon + 1)
            if (value.startsWith(" ")) value = value.substring(1)
            return line.substring(0, colon) to value
        }
    }
}

object SSEStream {
    /** 把行序列解析成 SSE 事件序列（测试可直接喂本地构造的行）。 */
    fun events(lines: Sequence<String>): Sequence<SSEEvent> = sequence {
        val parser = SSEParser()
        for (line in lines) {
            parser.process(line)?.let { yield(it) }
        }
        parser.finish()?.let { yield(it) }
    }
}
