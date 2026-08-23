package com.personalsite.features.ainews

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.personalsite.core.PSColors
import com.personalsite.core.SupabaseClientProvider
import com.personalsite.features.support.ContentListMetadataLine
import com.personalsite.features.support.ContentListMetrics
import com.personalsite.features.support.LoadStateView
import com.personalsite.features.support.contentListBody
import com.personalsite.models.AiNewsCategory
import com.personalsite.models.AiNewsDayGroup
import com.personalsite.models.AiNewsGrouping
import com.personalsite.models.AiNewsListItem
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.launch

/** AI 动态列表：直连 ai_news_public_items，按北京时间日分组，倒序分页。 */
class AiNewsListModel : ViewModel() {
    var groups by mutableStateOf<List<AiNewsDayGroup<AiNewsListItem>>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var isRefreshing by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    private var offset = 0
    private var hasMore = true

    val isEmpty: Boolean get() = groups.isEmpty()

    fun loadInitial() {
        if (groups.isNotEmpty() || isLoading) return
        load(reset = true)
    }

    fun refresh() {
        if (isRefreshing) return
        isRefreshing = true
        load(reset = true) { isRefreshing = false }
    }

    fun loadMoreIfNeeded(currentItemId: String) {
        val allItems = groups.flatMap { it.items }
        if (!hasMore || isLoading || currentItemId != allItems.lastOrNull()?.id) return
        load(reset = false)
    }

    private fun load(reset: Boolean, onComplete: (() -> Unit)? = null) {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                if (reset) {
                    offset = 0
                    hasMore = true
                }
                // 多取一条判断 hasMore，与 Web 的 getAiNewsPage 一致。
                // 与 Web 端相同的 PostgREST 投影：content jsonb 字段别名平铺成行。
                val rows = SupabaseClientProvider.shared
                    .from("ai_news_public_items")
                    .select(columns = Columns.raw(LIST_SELECT)) {
                        order("published_at", Order.DESCENDING, nullsFirst = false)
                        range(offset.toLong(), (offset + PAGE_SIZE).toLong())
                    }
                    .decodeList<AiNewsListItem>()
                hasMore = rows.size > PAGE_SIZE
                val pageItems = rows.take(PAGE_SIZE)
                val merged = if (reset) pageItems else groups.flatMap { it.items } + pageItems
                offset += pageItems.size
                groups = AiNewsGrouping.group(merged) { it.publishedAt }
            } catch (_: Exception) {
                errorMessage = "读取每日动态失败，请检查网络后重试。"
            } finally {
                isLoading = false
                onComplete?.invoke()
            }
        }
    }

    companion object {
        private const val PAGE_SIZE = 50
        private const val LIST_SELECT =
            "category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title"
    }
}

/** 每日动态列表页：日分组 Section + 行 + 滚动到底分页 + 下拉刷新（对齐 iOS AiNewsView）。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AiNewsView(
    onOpenDetail: (String) -> Unit,
    onHeaderCollapse: (Boolean) -> Unit,
    model: AiNewsListModel = viewModel(),
) {
    val listState = rememberLazyListState()

    // 滚动超过 ~20dp 时折叠页头，回落时恢复（对齐 iOS ScrollCollapseSensor）
    val collapseThreshold = with(LocalDensity.current) { 20.dp.roundToPx() }
    val headerCollapsed by remember {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 ||
                listState.firstVisibleItemScrollOffset > collapseThreshold
        }
    }
    LaunchedEffect(headerCollapsed) { onHeaderCollapse(headerCollapsed) }

    // 最后一条数据行可见时触发分页（对齐 iOS 行 onAppear 里的 loadMoreIfNeeded）
    val lastVisibleItemId by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val lastIndex = info.totalItemsCount - 1
            if (lastIndex >= 0 && info.visibleItemsInfo.any { it.index == lastIndex }) {
                model.groups.flatMap { it.items }.lastOrNull()?.id
            } else {
                null
            }
        }
    }
    LaunchedEffect(lastVisibleItemId) {
        lastVisibleItemId?.let { model.loadMoreIfNeeded(it) }
    }

    LaunchedEffect(Unit) { model.loadInitial() }

    LoadStateView(
        isLoading = model.isLoading && model.isEmpty,
        errorMessage = if (model.isEmpty) model.errorMessage else null,
        isEmpty = model.isEmpty,
        emptyMessage = "暂无每日动态",
        onRetry = { model.refresh() },
    ) {
        PullToRefreshBox(
            isRefreshing = model.isRefreshing,
            onRefresh = { model.refresh() },
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .background(PSColors.surface),
            ) {
                model.groups.forEach { group ->
                    item(key = "header:${group.dayKey}") {
                        AiNewsDayHeader(group = group)
                    }
                    items(group.items, key = { it.id }) { item ->
                        AiNewsRow(item = item, onClick = { onOpenDetail(item.id) })
                    }
                }
            }
        }
    }
}

/** 日分组头：日期 label + 中文 weekday（对齐 iOS Section header）。 */
@Composable
private fun AiNewsDayHeader(group: AiNewsDayGroup<AiNewsListItem>) {
    Row(
        verticalAlignment = Alignment.Bottom,
        modifier = Modifier
            .fillMaxWidth()
            .background(PSColors.surface)
            .padding(horizontal = 16.dp)
            .padding(top = 10.dp, bottom = 2.dp),
    ) {
        Text(
            group.label,
            fontSize = 14.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PSColors.ink,
        )
        if (group.weekday.isNotEmpty()) {
            Spacer(Modifier.width(6.dp))
            Text(
                group.weekday,
                fontSize = ContentListMetrics.metadataSize,
                fontWeight = FontWeight.Medium,
                color = PSColors.quiet,
            )
        }
    }
}

/** 列表行：元信息行（分类 · 相对时间）+ 标题（2 行）+ 摘要（2 行）。 */
@Composable
private fun AiNewsRow(item: AiNewsListItem, onClick: () -> Unit) {
    Column(
        verticalArrangement = Arrangement.spacedBy(ContentListMetrics.rowSpacing),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(ContentListMetrics.rowPadding)
            .contentListBody(),
    ) {
        ContentListMetadataLine(
            items = listOf(
                AiNewsCategory.label(item.category),
                AiNewsGrouping.relativeTime(item.publishedAt) ?: "",
            ),
        )
        Text(
            item.title,
            fontSize = ContentListMetrics.titleSize,
            fontWeight = FontWeight.SemiBold,
            color = PSColors.ink,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (item.summary.isNotEmpty()) {
            Text(
                item.summary,
                fontSize = ContentListMetrics.summarySize,
                color = PSColors.quiet,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
