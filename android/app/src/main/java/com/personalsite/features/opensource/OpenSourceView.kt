package com.personalsite.features.opensource

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.personalsite.core.PSColors
import com.personalsite.core.SiteApiClient
import com.personalsite.features.support.ContentListMetadataLine
import com.personalsite.features.support.ContentListMetrics
import com.personalsite.features.support.LoadStateView
import com.personalsite.features.support.MarkdownText
import com.personalsite.features.support.contentListBody
import com.personalsite.models.OpenSourceEntry
import com.personalsite.models.OpenSourceListEntry
import kotlinx.coroutines.launch

/** 开源关注内部导航：列表 → 详情 → 仓库目录/文件。 */
sealed interface OpenSourceRoute {
    data class Detail(val slug: String) : OpenSourceRoute
    data class Directory(val slug: String, val path: String) : OpenSourceRoute
    data class File(val slug: String, val path: String) : OpenSourceRoute
}

/** 开源关注列表：经站点 API 读取随部署打包的本地 SQLite 投影。 */
class OpenSourceListModel : ViewModel() {
    var entries by mutableStateOf<List<OpenSourceListEntry>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    fun loadInitial() {
        if (entries.isNotEmpty() || isLoading) return
        load()
    }

    fun refresh() = load()

    private fun load() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                entries = SiteApiClient().get("/api/open-source")
            } catch (e: Exception) {
                errorMessage = "读取开源关注失败，请检查网络后重试。"
            }
            isLoading = false
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OpenSourceView(
    onOpenDetail: (String) -> Unit,
    onHeaderCollapse: (Boolean) -> Unit,
) {
    val model: OpenSourceListModel = viewModel()
    val listState = rememberLazyListState()
    val collapseThresholdPx = with(LocalDensity.current) { 20.dp.toPx() }

    // 滚动超 ~20dp 收起头部（对齐 iOS ScrollCollapseSensor）
    LaunchedEffect(listState) {
        snapshotFlow {
            listState.firstVisibleItemIndex > 0 ||
                listState.firstVisibleItemScrollOffset > collapseThresholdPx
        }.collect { onHeaderCollapse(it) }
    }
    LaunchedEffect(Unit) { model.loadInitial() }

    LoadStateView(
        isLoading = model.isLoading && model.entries.isEmpty(),
        // 刷新失败保留旧列表（对齐 iOS 行为），仅空列表时展示错误态
        errorMessage = if (model.entries.isEmpty()) model.errorMessage else null,
        isEmpty = model.entries.isEmpty(),
        emptyMessage = "暂无开源关注",
        onRetry = model::refresh,
    ) {
        PullToRefreshBox(
            isRefreshing = model.isLoading,
            onRefresh = model::refresh,
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().background(PSColors.surface),
            ) {
                items(model.entries, key = { it.slug }) { entry ->
                    OpenSourceRow(entry = entry, onClick = { onOpenDetail(entry.slug) })
                }
            }
        }
    }
}

@Composable
private fun OpenSourceRow(entry: OpenSourceListEntry, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(ContentListMetrics.rowPadding)
            .contentListBody(),
        verticalArrangement = Arrangement.spacedBy(ContentListMetrics.rowSpacing),
    ) {
        ContentListMetadataLine(items = listOf(entry.category.label, entry.status.raw))
        Text(
            text = entry.repository,
            fontSize = ContentListMetrics.titleSize,
            fontWeight = FontWeight.SemiBold,
            color = PSColors.ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (entry.sourceSummary.isNotEmpty()) {
            Text(
                text = entry.sourceSummary,
                fontSize = ContentListMetrics.summarySize,
                color = PSColors.quiet,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** 开源关注详情：分类/维度标签、摘要、判读、中文阅读版（Markdown），入口进仓库浏览。 */
@Composable
fun OpenSourceDetailView(slug: String, onBrowseRepository: (String) -> Unit) {
    var entry by remember { mutableStateOf<OpenSourceEntry?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val uriHandler = LocalUriHandler.current

    suspend fun load() {
        errorMessage = null
        try {
            entry = SiteApiClient().get("/api/open-source/$slug")
        } catch (e: Exception) {
            errorMessage = "读取开源关注详情失败，请稍后重试。"
        }
    }

    LaunchedEffect(slug) { load() }

    LoadStateView(
        isLoading = entry == null && errorMessage == null,
        errorMessage = errorMessage,
        isEmpty = false,
        emptyMessage = "",
        onRetry = { scope.launch { load() } },
    ) {
        entry?.let { OpenSourceDetailContent(it, onBrowseRepository, uriHandler::openUri) }
    }
}

@Composable
private fun OpenSourceDetailContent(
    entry: OpenSourceEntry,
    onBrowseRepository: (String) -> Unit,
    openUri: (String) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = entry.repository,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PSColors.ink,
        )
        Text(
            text = "${entry.category.label} · ${entry.status.raw}",
            fontSize = 12.sp,
            color = PSColors.quiet,
        )
        if (entry.dimensions.isNotEmpty()) {
            Text(
                text = entry.dimensions.joinToString(" · ") { it.label },
                fontSize = 12.sp,
                color = PSColors.quiet,
            )
        }
        if (entry.sourceSummary.isNotEmpty()) {
            DetailSection(title = "摘要") {
                Text(entry.sourceSummary, color = PSColors.quiet)
            }
        }
        if (entry.personalNote.isNotEmpty()) {
            DetailSection(title = "判读") {
                Text(entry.personalNote, color = PSColors.quiet)
            }
        }
        entry.parsedMarkdown?.takeIf { it.isNotEmpty() }?.let { markdown ->
            DetailSection(title = "中文阅读版") {
                MarkdownText(markdown = markdown)
            }
        }
        Row(
            modifier = Modifier
                .clickable { onBrowseRepository(entry.slug) }
                .padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Folder,
                contentDescription = null,
                tint = PSColors.ink,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(6.dp))
            Text("浏览仓库", fontWeight = FontWeight.SemiBold, color = PSColors.ink)
        }
        Text(
            text = "在 GitHub 查看",
            fontSize = 15.sp,
            color = PSColors.link,
            modifier = Modifier.clickable { openUri(entry.repositoryUrl) },
        )
    }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
        content()
    }
}
