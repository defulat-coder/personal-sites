package com.personalsite.features.works

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.SubcomposeAsyncImage
import com.personalsite.core.Config
import com.personalsite.core.PSColors
import com.personalsite.features.support.ContentListMetadataLine
import com.personalsite.features.support.LoadStateView
import com.personalsite.features.support.MarkdownText
import com.personalsite.models.Work
import com.personalsite.models.WorkPublicRow
import com.personalsite.models.WorkRecord
import com.personalsite.models.WorkShot
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.launch

/**
 * 作品档案：直连 project_public_snapshots，snapshot jsonb 平铺成 Work（对齐 lib/works.ts 的 toWork）。
 */
class WorksListModel : ViewModel() {
    var works by mutableStateOf<List<Work>>(emptyList())
        private set
    var isLoading by mutableStateOf(false)
        private set
    var errorMessage by mutableStateOf<String?>(null)
        private set

    val isEmpty: Boolean get() = works.isEmpty()

    fun loadInitial() {
        if (works.isNotEmpty() || isLoading) return
        load()
    }

    fun refresh() {
        if (isLoading) return
        load()
    }

    private fun load() {
        viewModelScope.launch {
            isLoading = true
            errorMessage = null
            try {
                // 与 Web 端同排序：display_order 升序，再按 published_at 倒序。
                val rows: List<WorkPublicRow> = com.personalsite.core.SupabaseClientProvider.shared
                    .from("project_public_snapshots")
                    .select(columns = Columns.raw("display_order,published_at,snapshot")) {
                        order("display_order", Order.ASCENDING)
                        order("published_at", Order.DESCENDING)
                    }
                    .decodeList()
                works = rows.map(::Work)
            } catch (e: Exception) {
                errorMessage = "读取构建档案失败，请检查网络后重试。"
            } finally {
                isLoading = false
            }
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun WorksView(
    onHeaderCollapse: (Boolean) -> Unit,
    model: WorksListModel = viewModel(),
) {
    // 详情导航在模块内本地维护（对齐 iOS navigationDestination(for: Work)），用 slug 定位。
    var selectedSlug by rememberSaveable { mutableStateOf<String?>(null) }
    val selected = model.works.firstOrNull { it.slug == selectedSlug }

    LaunchedEffect(Unit) { model.loadInitial() }

    if (selected != null) {
        WorkDetailView(work = selected, onBack = { selectedSlug = null })
        return
    }

    LoadStateView(
        isLoading = model.isLoading,
        errorMessage = model.errorMessage,
        isEmpty = model.isEmpty,
        emptyMessage = "暂无构建档案",
        onRetry = { model.refresh() },
    ) {
        val listState = rememberLazyListState()
        val density = LocalDensity.current

        // 对齐 iOS trackHeaderCollapse：滚动超 ~20dp 折叠，回到 ~4dp 内展开（迟滞避免抖动）。
        LaunchedEffect(listState) {
            var collapsed = false
            snapshotFlow {
                listState.firstVisibleItemIndex to listState.firstVisibleItemScrollOffset
            }.collect { (index, offset) ->
                val offsetDp = with(density) { offset.toDp() }
                val next = if (collapsed) {
                    index > 0 || offsetDp > 4.dp
                } else {
                    index > 0 || offsetDp > 20.dp
                }
                if (next != collapsed) {
                    collapsed = next
                    onHeaderCollapse(next)
                }
            }
        }

        PullToRefreshBox(
            isRefreshing = model.isLoading && model.works.isNotEmpty(),
            onRefresh = { model.refresh() },
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .background(PSColors.surface)
                    .padding(horizontal = 16.dp),
            ) {
                items(model.works, key = { it.id }) { work ->
                    WorkArchiveRow(work = work, onClick = { selectedSlug = work.slug })
                    if (work.id != model.works.lastOrNull()?.id) {
                        // 0.5dp hairline 分隔线（对齐 iOS Rectangle height 0.5）。
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(0.5.dp)
                                .background(PSColors.line),
                        )
                    }
                }
            }
        }
    }
}

/** 列表行：元信息 + 标题 + 摘要（对齐 iOS WorkArchiveRow）。 */
@Composable
private fun WorkArchiveRow(work: Work, onClick: () -> Unit) {
    Column(
        verticalArrangement = Arrangement.spacedBy(9.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 142.dp)
            .clickable(onClick = onClick)
            .padding(vertical = 18.dp),
    ) {
        ContentListMetadataLine(items = listOf(work.period, work.status))

        Text(
            text = work.title,
            fontSize = 19.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.34).sp, // iOS tracking(-0.018 * 19)
            color = PSColors.ink,
        )

        Text(
            text = work.summary,
            fontSize = 14.sp,
            lineHeight = 16.5.sp, // iOS lineSpacing(2.5)
            color = PSColors.quiet,
            maxLines = 3,
        )
    }
}

/** 详情：内容逐段对齐 iOS WorkDetailView。 */
@Composable
fun WorkDetailView(work: Work, onBack: () -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(PSColors.surface),
    ) {
        // 返回按钮（对齐 iOS navigationBar 返回）。
        IconButton(onClick = onBack) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "返回",
                tint = PSColors.ink,
            )
        }
        Column(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text(
                text = work.title,
                fontSize = 22.sp, // iOS .title2
                fontWeight = FontWeight.SemiBold,
                color = PSColors.ink,
            )
            Text(
                text = "${work.role} · ${work.period} · ${work.status}",
                fontSize = 12.sp, // iOS .caption
                color = PSColors.quiet,
            )
            if (work.stack.isNotEmpty()) {
                Text(
                    text = work.stack.joinToString(" · "),
                    fontSize = 12.sp,
                    color = PSColors.quiet,
                )
            }
            if (work.currentFocus.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("当前关注", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                    Text(work.currentFocus, color = PSColors.quiet)
                }
            }
            if (work.body.isNotEmpty()) {
                MarkdownText(markdown = work.body)
            } else if (work.summary.isNotEmpty()) {
                Text(work.summary, color = PSColors.quiet)
            }

            // 截图：站点相对路径拼 siteBaseURL。
            work.shots.forEach { shot ->
                WorkShotImage(shot)
            }

            if (work.records.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("记录", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                    work.records.forEach { record ->
                        WorkRecordRow(record)
                    }
                }
            }
        }
    }
}

/** 截图卡：16:9 + 圆角 12 + label（对齐 iOS AsyncImage 段落）。 */
@Composable
private fun WorkShotImage(shot: WorkShot) {
    val url = shotUrl(shot.src) ?: return
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SubcomposeAsyncImage(
            model = url,
            contentDescription = shot.label,
            contentScale = ContentScale.Fit,
            loading = {
                Box(Modifier.fillMaxSize()) {
                    CircularProgressIndicator(Modifier.align(Alignment.Center))
                }
            },
            error = {
                Box(Modifier.fillMaxSize()) {
                    Text(
                        "图片加载失败",
                        color = PSColors.quiet,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .clip(RoundedCornerShape(12.dp))
                .background(PSColors.line),
        )
        Text(shot.label, fontSize = 12.sp, color = PSColors.quiet)
    }
}

/** 记录行：kind 胶囊描边 + occurredAt + 标题 + 摘要（对齐 iOS records 段落）。 */
@Composable
private fun WorkRecordRow(record: WorkRecord) {
    Column(
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = record.kind.label,
                fontSize = 12.sp,
                color = PSColors.quiet,
                modifier = Modifier
                    .border(0.5.dp, PSColors.quiet, CircleShape)
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
            record.occurredAt?.let {
                Text(it, fontSize = 12.sp, color = PSColors.quiet)
            }
        }
        Text(record.title, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PSColors.ink)
        if (record.summary.isNotEmpty()) {
            Text(record.summary, fontSize = 13.sp, color = PSColors.quiet)
        }
    }
}

/** src 以 "/" 开头时拼 siteBaseURL，否则按绝对 URL 处理。 */
private fun shotUrl(src: String): String? {
    if (src.isBlank()) return null
    return if (src.startsWith("/")) Config.siteBaseUrl + src else src
}
