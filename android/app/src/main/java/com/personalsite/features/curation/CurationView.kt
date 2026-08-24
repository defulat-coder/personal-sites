package com.personalsite.features.curation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.personalsite.core.PSColors
import com.personalsite.core.SiteApiClient
import com.personalsite.features.support.ContentListMetadataLine
import com.personalsite.features.support.ContentListMetrics
import com.personalsite.features.support.LoadStateView
import com.personalsite.features.support.contentListBody
import com.personalsite.models.CurationListItem
import com.personalsite.models.CurationPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 策展列表：走站点 /api/curation 分页（20/页，offset 服务端会向下取整）。
 * 状态与分页逻辑对齐 iOS CurationListModel。
 */
class CurationListModel : ViewModel() {
    var items by mutableStateOf<List<CurationListItem>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set
    private var hasMore = true

    private val isEmpty: Boolean get() = items.isEmpty()

    fun loadInitial() {
        if (items.isNotEmpty() || isLoading) return
        load(reset = true)
    }

    fun refresh() {
        load(reset = true)
    }

    fun loadMoreIfNeeded(currentItem: CurationListItem) {
        if (!hasMore || isLoading || currentItem.id != items.lastOrNull()?.id) return
        load(reset = false)
    }

    private fun load(reset: Boolean) {
        if (isLoading) return
        isLoading = true
        errorMessage = null
        viewModelScope.launch {
            try {
                val offset = if (reset) 0 else items.size
                val page: CurationPage = withContext(Dispatchers.IO) {
                    SiteApiClient().get(
                        "/api/curation",
                        mapOf("limit" to PAGE_SIZE.toString(), "offset" to offset.toString()),
                    )
                }
                // 与 Web / iOS 客户端一致：offset 取整可能带回重复条目，按 id 去重丢弃。
                val known = items.mapTo(HashSet()) { it.id }
                val fresh = if (reset) page.items else page.items.filter { it.id !in known }
                items = if (reset) page.items else items + fresh
                hasMore = page.hasMore
            } catch (e: Exception) {
                errorMessage = "读取策展失败，请检查网络后重试。"
            } finally {
                isLoading = false
            }
        }
    }

    companion object {
        private const val PAGE_SIZE = 20
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CurationView(
    onOpenDetail: (String) -> Unit,
    onHeaderCollapse: (Boolean) -> Unit,
    model: CurationListModel = viewModel(),
) {
    val listState = rememberLazyListState()
    val collapseThresholdPx = with(LocalDensity.current) { 20.dp.toPx() }

    // 滚动超 ~20dp 收起页头（对齐 iOS ScrollCollapseSensor）
    LaunchedEffect(listState) {
        snapshotFlow {
            listState.firstVisibleItemIndex > 0 ||
                listState.firstVisibleItemScrollOffset > collapseThresholdPx
        }
            .distinctUntilChanged()
            .collect { onHeaderCollapse(it) }
    }

    // 末项可见时翻页（对齐 iOS onAppear -> loadMoreIfNeeded）
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastIndex ->
                val last = model.items.lastOrNull()
                if (lastIndex != null && last != null && lastIndex >= model.items.lastIndex) {
                    model.loadMoreIfNeeded(currentItem = last)
                }
            }
    }

    LaunchedEffect(Unit) { model.loadInitial() }

    LoadStateView(
        isLoading = model.isLoading && model.items.isEmpty(),
        errorMessage = if (model.items.isEmpty()) model.errorMessage else null,
        isEmpty = model.items.isEmpty(),
        emptyMessage = "暂无策展内容",
        onRetry = { model.refresh() },
    ) {
        // 下拉刷新（对齐 iOS refreshable）：仅下拉手势置刷新态，翻页 loading 不占位
        var isRefreshing by remember { mutableStateOf(false) }
        LaunchedEffect(model.isLoading) {
            if (!model.isLoading) isRefreshing = false
        }
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                model.refresh()
            },
            state = rememberPullToRefreshState(),
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().background(PSColors.surface),
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                itemsIndexed(model.items, key = { _, item -> item.id }) { index, item ->
                    CurationRow(
                        item = item,
                        onClick = { onOpenDetail(item.id) },
                    )
                    if (index < model.items.lastIndex) {
                        HorizontalDivider(
                            color = PSColors.line,
                            modifier = Modifier.padding(start = 16.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CurationRow(item: CurationListItem, onClick: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(ContentListMetrics.rowPadding)
            .contentListBody(),
    ) {
        ContentListMetadataLine(
            items = listOf(
                if (item.source.platform == "x") "X · @${item.author.handle}" else "抖音 · ${item.author.name}",
                item.tags.firstOrNull().orEmpty(),
            ),
        )
        Text(
            text = item.title,
            fontSize = ContentListMetrics.titleSize,
            fontWeight = FontWeight.Medium,
            color = PSColors.ink,
            maxLines = 2,
            modifier = Modifier.padding(top = ContentListMetrics.rowSpacing),
        )
        if (item.summary.isNotEmpty()) {
            Text(
                text = item.summary,
                fontSize = ContentListMetrics.summarySize,
                color = PSColors.quiet,
                maxLines = 2,
                modifier = Modifier.padding(top = ContentListMetrics.rowSpacing),
            )
        }
    }
}
