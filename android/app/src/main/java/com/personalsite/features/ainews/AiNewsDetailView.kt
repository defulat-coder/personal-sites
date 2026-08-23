package com.personalsite.features.ainews

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.core.PSColors
import com.personalsite.core.SupabaseClientProvider
import com.personalsite.features.support.LoadStateView
import com.personalsite.features.support.MarkdownText
import com.personalsite.models.AiNewsCategory
import com.personalsite.models.AiNewsGrouping
import com.personalsite.models.AiNewsItem
import com.personalsite.models.AiNewsPublicRow
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch

/** AI 动态详情：进页后按 id 拉完整行（reason/score/url 仅详情有）。 */
@Composable
fun AiNewsDetailView(id: String) {
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current

    var item by remember(id) { mutableStateOf<AiNewsItem?>(null) }
    var errorMessage by remember(id) { mutableStateOf<String?>(null) }
    var isLoading by remember(id) { mutableStateOf(true) }

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val row = SupabaseClientProvider.shared
                    .from("ai_news_public_items")
                    .select(columns = Columns.raw("content,selected,published_at")) {
                        filter { eq("id", id) }
                    }
                    .decodeSingle<AiNewsPublicRow>()
                item = row.item
            } catch (_: Exception) {
                errorMessage = "读取动态详情失败，请稍后重试。"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(id) { load() }

    LoadStateView(
        isLoading = isLoading && item == null,
        errorMessage = if (item == null) errorMessage else null,
        isEmpty = false,
        emptyMessage = "",
        onRetry = { load() },
    ) {
        val current = item ?: return@LoadStateView
        Column(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .fillMaxSize()
                .background(PSColors.surface)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text(
                current.title,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = PSColors.ink,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    AiNewsCategory.label(current.category),
                    fontSize = 12.sp,
                    color = PSColors.quiet,
                )
                AiNewsGrouping.relativeTime(current.publishedAt)?.let { relative ->
                    Text(relative, fontSize = 12.sp, color = PSColors.quiet)
                }
                Text(
                    current.sourceName,
                    fontSize = 12.sp,
                    color = PSColors.quiet,
                )
            }
            if (current.summary.isNotEmpty()) {
                MarkdownText(
                    markdown = current.summary,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (current.reason.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "评分理由",
                        fontWeight = FontWeight.SemiBold,
                        color = PSColors.ink,
                    )
                    Text(current.reason, color = PSColors.quiet)
                }
            }
            if (current.url.isNotEmpty()) {
                Text(
                    "查看原文",
                    fontWeight = FontWeight.SemiBold,
                    color = PSColors.link,
                    modifier = Modifier.clickable { uriHandler.openUri(current.url) },
                )
            }
        }
    }
}
