package com.personalsite.features.support

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.personalsite.core.PSColors
import com.personalsite.core.PSMotion

/**
 * 轻量 Markdown 渲染（对齐 iOS MarkdownText）：仅行内语法 —— 粗体、斜体、行内代码、链接；
 * 解析失败退化为原文。
 */
@Composable
fun MarkdownText(markdown: String, modifier: Modifier = Modifier) {
    Text(text = renderInlineMarkdown(markdown), modifier = modifier)
}

/** 行内级 Markdown → AnnotatedString。链接渲染为下划线文本（长按/点击由调用方决定）。 */
fun renderInlineMarkdown(markdown: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    val n = markdown.length
    fun findFrom(token: String, start: Int): Int = markdown.indexOf(token, start)

    while (i < n) {
        when {
            markdown.startsWith("**", i) -> {
                val end = findFrom("**", i + 2)
                if (end < 0) { append(markdown[i]); i += 1 } else {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(renderInlineMarkdown(markdown.substring(i + 2, end)))
                    }
                    i = end + 2
                }
            }
            markdown.startsWith("*", i) -> {
                val end = findFrom("*", i + 1)
                if (end <= i + 1) { append(markdown[i]); i += 1 } else {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(renderInlineMarkdown(markdown.substring(i + 1, end)))
                    }
                    i = end + 1
                }
            }
            markdown.startsWith("`", i) -> {
                val end = findFrom("`", i + 1)
                if (end < 0) { append(markdown[i]); i += 1 } else {
                    withStyle(SpanStyle(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)) {
                        append(markdown.substring(i + 1, end))
                    }
                    i = end + 1
                }
            }
            markdown.startsWith("[", i) -> {
                val closeLabel = findFrom("](", i + 1)
                val closeUrl = if (closeLabel >= 0) findFrom(")", closeLabel + 2) else -1
                if (closeLabel < 0 || closeUrl < 0) { append(markdown[i]); i += 1 } else {
                    withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) {
                        append(renderInlineMarkdown(markdown.substring(i + 1, closeLabel)))
                    }
                    i = closeUrl + 1
                }
            }
            else -> {
                append(markdown[i])
                i += 1
            }
        }
    }
}

enum class LoadStateIdentity { LOADING, ERROR, EMPTY, CONTENT }

/** 列表通用三态：加载中 / 失败重试 / 内容。空态由 emptyMessage 处理。 */
@Composable
fun LoadStateView(
    isLoading: Boolean,
    errorMessage: String?,
    isEmpty: Boolean,
    emptyMessage: String,
    onRetry: () -> Unit,
    content: @Composable () -> Unit,
) {
    val state = when {
        isLoading -> LoadStateIdentity.LOADING
        errorMessage != null -> LoadStateIdentity.ERROR
        isEmpty -> LoadStateIdentity.EMPTY
        else -> LoadStateIdentity.CONTENT
    }
    Crossfade(
        targetState = state,
        animationSpec = tween(PSMotion.STATE_CHANGE_MS),
        label = "load-state",
    ) { current ->
        when (current) {
            LoadStateIdentity.LOADING -> Box(Modifier.fillMaxSize()) {
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            }
            LoadStateIdentity.ERROR -> CenteredMessage(title = "加载失败", detail = errorMessage) {
                Button(onClick = onRetry) { Text("重试") }
            }
            LoadStateIdentity.EMPTY -> CenteredMessage(title = emptyMessage, detail = null)
            LoadStateIdentity.CONTENT -> content()
        }
    }
}

@Composable
private fun CenteredMessage(
    title: String,
    detail: String?,
    action: (@Composable () -> Unit)? = null,
) {
    Box(Modifier.fillMaxSize().padding(24.dp)) {
        Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, color = PSColors.ink, fontWeight = FontWeight.SemiBold)
            if (detail != null) {
                Spacer(Modifier.height(8.dp))
                Text(detail, color = PSColors.quiet)
            }
            if (action != null) {
                Spacer(Modifier.height(12.dp))
                action()
            }
        }
    }
}
