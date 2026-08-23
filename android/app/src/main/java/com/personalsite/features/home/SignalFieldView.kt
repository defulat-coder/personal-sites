package com.personalsite.features.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

object SignalFieldActivity {
    fun shouldAnimate(reduceMotion: Boolean, sceneIsActive: Boolean, isVisible: Boolean): Boolean =
        !reduceMotion && sceneIsActive && isVisible
}

/**
 * 信号场：点阵背景 + 词条弹幕，对齐 components/interactive-dot-field.tsx 与
 * iOS SignalFieldView。词条从右向左匀速划过六条水平泳道，参数全部由
 * SignalFieldTerms 的索引纯函数给出。深色模式对齐 Web 的 filter:invert(1)。
 */
@Composable
fun SignalFieldView(
    reduceMotion: Boolean,
    sceneIsActive: Boolean,
    modifier: Modifier = Modifier,
) {
    val dark = isSystemInDarkTheme()
    Box(
        modifier.graphicsLayer { if (dark) invertColorFilter() }
    ) {
        if (reduceMotion) {
            StaticSignalGrid()
        } else {
            SignalMarquee(sceneIsActive = sceneIsActive)
        }
    }
}

/** 深色模式下反色：对齐 Web 的 filter:invert(1)（内部固定浅色绘制）。 */
private fun androidx.compose.ui.graphics.GraphicsLayerScope.invertColorFilter() {
    colorFilter = androidx.compose.ui.graphics.ColorFilter.colorMatrix(
        androidx.compose.ui.graphics.ColorMatrix(
            floatArrayOf(
                -1f, 0f, 0f, 0f, 255f,
                0f, -1f, 0f, 0f, 255f,
                0f, 0f, -1f, 0f, 255f,
                0f, 0f, 0f, 1f, 0f,
            )
        )
    )
}

private val fieldHeight = 184.dp
private val signalsInset = 12.dp
private val dotSpacing = 9.dp
private val fieldInk = Color(28 / 255f, 28 / 255f, 30 / 255f)

private data class SignalTrackItem(
    val index: Int,
    val term: String,
    val track: SignalFieldTerms.Track,
)

@Composable
private fun SignalMarquee(sceneIsActive: Boolean) {
    val density = LocalDensity.current
    var startNanos by remember { mutableLongStateOf(-1L) }
    var elapsedSeconds by remember { mutableStateOf(0.0) }
    var isVisible by remember { mutableStateOf(false) }
    var windowHeightPx by remember { mutableStateOf(1) }

    val shouldAnimate = SignalFieldActivity.shouldAnimate(
        reduceMotion = false,
        sceneIsActive = sceneIsActive,
        isVisible = isVisible,
    )

    LaunchedEffect(shouldAnimate) {
        if (!shouldAnimate) return@LaunchedEffect
        if (startNanos < 0) startNanos = System.nanoTime()
        while (true) {
            withFrameNanos {
                elapsedSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
            }
        }
    }

    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(fieldHeight)
            .clipToBounds()
            .onGloballyPositioned { coordinates ->
                windowHeightPx = coordinates.parentLayoutCoordinates?.size?.height
                    ?: windowHeightPx
                val pos = coordinates.positionInWindow()
                isVisible = pos.y < windowHeightPx && pos.y + coordinates.size.height > 0
            }
    ) {
        val widthDp = with(density) { constraints.maxWidth.toDp().value.toDouble() }
        val signalsHeightDp = (fieldHeight - signalsInset * 2).value.toDouble()

        // 点阵
        Canvas(Modifier.fillMaxSize()) {
            val spacingPx = dotSpacing.toPx()
            var y = 0f
            while (y <= size.height) {
                var x = 0f
                while (x <= size.width) {
                    drawCircle(color = fieldInk.copy(alpha = 0.27f), radius = 1f, center = Offset(x, y))
                    x += spacingPx
                }
                y += spacingPx
            }
        }

        // 词条弹幕
        val trackItems = remember {
            SignalFieldTerms.selectedTerms.mapIndexed { index, term ->
                SignalTrackItem(
                    index = index,
                    term = term,
                    track = SignalFieldTerms.track(index, SignalFieldTerms.selectedTerms.size),
                )
            }
        }
        trackItems.forEach { item ->
            val frame = SignalFieldTerms.marqueeFrame(
                progress = SignalFieldTerms.progress(elapsedSeconds, item.track),
                width = widthDp,
                drift = item.track.drift,
            )
            Box(
                Modifier.offset {
                    androidx.compose.ui.unit.IntOffset(
                        x = (frame.x * density.density).roundToInt(),
                        y = ((signalsInset.value + item.track.topFraction * signalsHeightDp + frame.yOffset) * density.density).roundToInt(),
                    )
                }
            ) {
                TermPill(item.term, item.index, alpha = frame.opacity * item.track.opacity)
            }
        }

        // 两侧淡出（内部固定浅色，深色由整体反色处理）
        EdgeFade(alignStart = true)
        EdgeFade(alignStart = false)
    }
}

@Composable
private fun androidx.compose.foundation.layout.BoxScope.EdgeFade(alignStart: Boolean) {
    Box(
        Modifier
            .align(if (alignStart) androidx.compose.ui.Alignment.CenterStart else androidx.compose.ui.Alignment.CenterEnd)
            .width(16.dp)
            .height(fieldHeight)
            .background(
                androidx.compose.ui.graphics.Brush.horizontalGradient(
                    colors = if (alignStart) {
                        listOf(Color.White, Color.White.copy(alpha = 0f))
                    } else {
                        listOf(Color.White.copy(alpha = 0f), Color.White)
                    }
                )
            )
    )
}

@Composable
private fun TermPill(term: String, index: Int, alpha: Double = 1.0) {
    val fontSize = SignalFieldTerms.fontSize(index).sp
    Text(
        text = term,
        fontSize = fontSize,
        fontWeight = FontWeight.SemiBold,
        fontFamily = FontFamily.Monospace,
        letterSpacing = (-0.035 * fontSize.value).sp,
        maxLines = 1,
        color = fieldInk.copy(alpha = 0.88f),
        modifier = Modifier
            .graphicsLayer { this.alpha = alpha.toFloat().coerceIn(0f, 1f) }
            .background(Color.White.copy(alpha = 0.94f))
            .border(1.dp, fieldInk.copy(alpha = SignalFieldTerms.borderAlpha(index).toFloat()))
            .padding(horizontal = 8.6.dp, vertical = 7.4.dp),
    )
}

/** reduced-motion：词条静止均布（对齐 iOS staticGrid）。 */
@Composable
private fun StaticSignalGrid() {
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        userScrollEnabled = false,
        modifier = Modifier
            .fillMaxWidth()
            .height(fieldHeight)
            .padding(vertical = 12.dp),
    ) {
        items(SignalFieldTerms.selectedTerms.size) { index ->
            TermPill(SignalFieldTerms.selectedTerms[index], index)
        }
    }
}
