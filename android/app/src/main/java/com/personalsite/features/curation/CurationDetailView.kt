package com.personalsite.features.curation

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.SubcomposeAsyncImage
import com.personalsite.core.PSColors
import com.personalsite.core.PSMotion
import com.personalsite.core.SiteApiClient
import com.personalsite.features.support.LoadStateIdentity
import com.personalsite.features.support.MarkdownText
import com.personalsite.models.CurationItem
import com.personalsite.models.CurationMedia
import com.personalsite.models.CurationMediaType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// 详情小标题（对齐 iOS .headline）
private val SectionTitleSize = 17.sp

/**
 * 策展详情：GET /api/curation/[id]，含 analysis（Markdown）、摘录、引用上下文与媒体。
 * 三态加载与段落顺序对齐 iOS CurationDetailView。
 */
@Composable
fun CurationDetailView(id: String) {
    var item by remember { mutableStateOf<CurationItem?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var retryTick by remember { mutableStateOf(0) }

    LaunchedEffect(id, retryTick) {
        if (item != null) return@LaunchedEffect
        errorMessage = null
        try {
            item = withContext(Dispatchers.IO) {
                SiteApiClient().get<CurationItem>("/api/curation/$id")
            }
        } catch (e: Exception) {
            errorMessage = "读取策展详情失败，请稍后重试。"
        }
    }

    // 三态切换带透明度过渡（对齐 iOS stateIdentity + .animation）
    val state = when {
        item != null -> LoadStateIdentity.CONTENT
        errorMessage != null -> LoadStateIdentity.ERROR
        else -> LoadStateIdentity.LOADING
    }
    Crossfade(
        targetState = state,
        animationSpec = tween(PSMotion.STATE_CHANGE_MS),
        label = "curation-detail-state",
        modifier = Modifier.fillMaxSize().background(PSColors.surface),
    ) { current ->
        when (current) {
            LoadStateIdentity.CONTENT -> item?.let { CurationDetailContent(it) }
            LoadStateIdentity.ERROR -> Box(Modifier.fillMaxSize().padding(24.dp)) {
                Column(
                    Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("加载失败", color = PSColors.ink, fontWeight = FontWeight.SemiBold)
                    errorMessage?.let { Text(it, color = PSColors.quiet, modifier = Modifier.padding(top = 8.dp)) }
                    Button(
                        onClick = { retryTick += 1 },
                        modifier = Modifier.padding(top = 12.dp),
                    ) { Text("重试") }
                }
            }
            else -> Box(Modifier.fillMaxSize()) {
                CircularProgressIndicator(Modifier.align(Alignment.Center))
            }
        }
    }
}

@Composable
private fun CurationDetailContent(item: CurationItem) {
    val uriHandler = LocalUriHandler.current
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = item.title,
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PSColors.ink,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = if (item.source.platform == "x") "${item.author.name} @${item.author.handle}" else "抖音 · ${item.author.name}",
                fontSize = 12.sp,
                color = PSColors.quiet,
            )
            item.publishedAt?.let {
                Text(
                    text = it.take(10),
                    fontSize = 12.sp,
                    color = PSColors.quiet,
                )
            }
        }
        if (item.tags.isNotEmpty()) {
            Text(
                text = item.tags.joinToString(" · "),
                fontSize = 12.sp,
                color = PSColors.quiet,
            )
        }

        item.media.forEach { media ->
            CurationMediaView(media = media)
        }

        if (item.text.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("来源摘录", fontSize = SectionTitleSize, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                Text(item.text, color = PSColors.quiet)
            }
        }

        item.quoteContext?.let { quote ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    "引用 ${quote.authorName} @${quote.author}",
                    fontSize = SectionTitleSize,
                    fontWeight = FontWeight.SemiBold,
                    color = PSColors.ink,
                )
                Text(quote.text, color = PSColors.quiet)
            }
        }

        if (item.analysis.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("分析", fontSize = SectionTitleSize, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                MarkdownText(markdown = item.analysis)
            }
        }

        if (item.source.url.isNotEmpty()) {
            Text(
                text = "查看${item.source.label}",
                fontSize = SectionTitleSize,
                fontWeight = FontWeight.SemiBold,
                color = PSColors.link,
                modifier = Modifier.clickable { uriHandler.openUri(item.source.url) },
            )
        }
    }
}

// 单个媒体：photo / animated_gif 走 Coil AsyncImage；video 用 ExoPlayer 经 /api/x-media 代理。
@Composable
private fun CurationMediaView(media: CurationMedia) {
    val aspectRatio = mediaAspectRatio(media)
    val shape = RoundedCornerShape(12.dp)
    when (media.type) {
        CurationMediaType.VIDEO -> {
            val raw = media.videoUrl
            if (raw != null) {
                // 视频经站点代理播放，避免 X 源站直链被拒
                val proxied = remember(raw) {
                    SiteApiClient().buildUrl("/api/x-media", mapOf("url" to raw)).toString()
                }
                CurationVideoPlayer(
                    url = proxied,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(aspectRatio)
                        .clip(shape),
                )
            }
        }
        CurationMediaType.PHOTO, CurationMediaType.ANIMATED_GIF -> {
            SubcomposeAsyncImage(
                model = media.url,
                contentDescription = null,
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
                    .aspectRatio(aspectRatio)
                    .clip(shape)
                    .background(PSColors.line),
            )
        }
    }
}

private fun mediaAspectRatio(media: CurationMedia): Float {
    val width = media.width
    val height = media.height
    if (width == null || height == null || height <= 0) return 16f / 9f
    return width.toFloat() / height.toFloat()
}

@Composable
private fun CurationVideoPlayer(url: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(url))
            prepare()
        }
    }
    // 离开组合即释放播放器
    DisposableEffect(player) {
        onDispose { player.release() }
    }
    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply { this.player = player }
        },
        modifier = modifier,
    )
}
