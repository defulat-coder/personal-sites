package com.personalsite.features.support

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

/**
 * 「关于我」打印小票浮层（对齐 iOS AboutPrintView）：
 * 打印机吐纸动画 + 小票（锯齿底边 + 虚线分隔 + 条形码）。
 */
@Composable
fun AboutPrintView(reduceMotion: Boolean, onDismiss: () -> Unit) {
    val dark = isSystemInDarkTheme()
    var paperProgress by remember { mutableFloatStateOf(0f) }
    var receiptHeightPx by remember { mutableFloatStateOf(1f) }
    var isPrinting by remember { mutableStateOf(true) }

    val animatedProgress by animateFloatAsState(
        targetValue = paperProgress,
        animationSpec = tween(180, easing = LinearEasing),
        label = "paper-feed",
    )

    LaunchedEffect(reduceMotion) {
        if (reduceMotion) {
            paperProgress = 1f
            isPrinting = false
            return@LaunchedEffect
        }
        paperProgress = 0f
        isPrinting = true
        val feedStops = listOf(0.09f, 0.19f, 0.30f, 0.42f, 0.55f, 0.68f, 0.80f, 0.90f, 0.97f, 1f)
        feedStops.forEachIndexed { index, stop ->
            paperProgress = stop
            delay(180)
            if (index < feedStops.size - 1) delay(66)
        }
        isPrinting = false
    }

    Box(Modifier.fillMaxSize()) {
        // 背板
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = if (dark) 0.56f else 0.36f))
                .clickable(onClick = onDismiss)
        )
        Column(
            Modifier
                .align(Alignment.TopCenter)
                .widthIn(max = 360.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 24.dp),
        ) {
            PrinterMachine(isPrinting = isPrinting, onDismiss = onDismiss)
            ReceiptOutput(
                progress = animatedProgress,
                receiptHeightPx = receiptHeightPx,
                onHeightMeasured = { receiptHeightPx = it.coerceAtLeast(1f) },
                hidden = isPrinting,
            )
        }
    }
}

@Composable
private fun PrinterMachine(isPrinting: Boolean, onDismiss: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .shadow(24.dp, RoundedCornerShape(22.dp), spotColor = Color.Black.copy(alpha = 0.18f))
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.verticalGradient(
                    listOf(Color(246 / 255f, 246 / 255f, 247 / 255f), Color(233 / 255f, 233 / 255f, 235 / 255f))
                )
            )
            .padding(horizontal = 14.dp)
            .padding(top = 14.dp, bottom = 12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .height(38.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(Color(23 / 255f, 23 / 255f, 26 / 255f))
                .padding(horizontal = 12.dp),
        ) {
            if (isPrinting) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    strokeWidth = 2.dp,
                    color = Color(232 / 255f, 232 / 255f, 234 / 255f),
                )
            } else {
                Icon(
                    Icons.Outlined.CheckCircle,
                    contentDescription = null,
                    tint = Color(232 / 255f, 232 / 255f, 234 / 255f),
                    modifier = Modifier.size(14.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                if (isPrinting) "正在打印个人经历…" else "打印完成 · 请取走小票",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = Color(232 / 255f, 232 / 255f, 234 / 255f),
            )
            Spacer(Modifier.weight(1f))
            Box(
                Modifier
                    .size(24.dp)
                    .clickable(onClick = onDismiss),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.Close,
                    contentDescription = "关闭",
                    tint = Color(232 / 255f, 232 / 255f, 234 / 255f),
                    modifier = Modifier.size(10.dp),
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        // 出纸口
        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
                .height(8.dp)
                .clip(RoundedCornerShape(50))
                .background(Color(18 / 255f, 18 / 255f, 20 / 255f))
        )
    }
}

@Composable
private fun ReceiptOutput(
    progress: Float,
    receiptHeightPx: Float,
    onHeightMeasured: (Float) -> Unit,
    hidden: Boolean,
) {
    val density = LocalDensity.current
    Box(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .offset(y = (-16).dp)
            .clipToBounds()
    ) {
        Box(
            Modifier
                .offset(y = with(density) { -((1 - progress) * (receiptHeightPx - 4).coerceAtLeast(0f)).toDp() })
                .then(if (hidden) Modifier else Modifier)
        ) {
            AboutReceiptView(onHeightMeasured = onHeightMeasured)
        }
    }
}

private data class ReceiptItem(val company: String, val meta: String, val years: String)

private val receiptItems = listOf(
    ReceiptItem("PLUS数字科技", "2014—2019 · Java · 服务运维", "5 年"),
    ReceiptItem("红星美凯龙", "2019—2023 · 业务 · 集团架构", "4 年"),
    ReceiptItem("喜马拉雅", "2023—2026 · 企业 AI 应用", "3 年"),
    ReceiptItem("PayerMax", "2026— · OPT · 端到端交付", "至今"),
)

@Composable
private fun AboutReceiptView(onHeightMeasured: (Float) -> Unit) {
    val ink = Color(28 / 255f, 28 / 255f, 30 / 255f)
    val quiet = Color(101 / 255f, 101 / 255f, 104 / 255f)
    Column(
        Modifier
            .fillMaxWidth()
            .onGloballyPositionedReceipt(onHeightMeasured)
            .shadow(14.dp, ReceiptPaperShape(), spotColor = Color.Black.copy(alpha = 0.2f))
            .clip(ReceiptPaperShape())
            .background(Color(248 / 255f, 248 / 255f, 246 / 255f))
            .padding(horizontal = 20.dp)
            .padding(top = 22.dp, bottom = 28.dp),
    ) {
        Text(
            "陈远 / CHEN YUAN",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.65.sp,
            color = ink,
        )
        Text(
            "个人经历 · CAREER RECEIPT",
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp,
            color = quiet,
            modifier = Modifier.padding(top = 4.dp),
        )
        ReceiptRule(Modifier.padding(vertical = 14.dp))
        Column {
            receiptItems.forEach { item ->
                Column(Modifier.padding(bottom = 12.dp)) {
                    Row(Modifier.fillMaxWidth()) {
                        Text(
                            item.company,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace,
                            color = ink,
                        )
                        Spacer(Modifier.weight(1f))
                        Text(
                            item.years,
                            fontSize = 11.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = FontFamily.Monospace,
                            color = ink,
                        )
                    }
                    Text(
                        item.meta,
                        fontSize = 10.sp,
                        fontFamily = FontFamily.Monospace,
                        color = quiet,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }
        }
        ReceiptRule(Modifier.padding(vertical = 14.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text("合计 TOTAL", fontSize = 11.sp, fontFamily = FontFamily.Monospace, color = Color(111 / 255f, 111 / 255f, 114 / 255f))
            Spacer(Modifier.weight(1f))
            Text("12 年", fontSize = 16.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = ink)
        }
        Text(
            "十二年 · 四段路 · 仍在增长",
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
            color = quiet,
            modifier = Modifier.padding(top = 16.dp),
        )
        ReceiptBarcode(Modifier.fillMaxWidth().height(30.dp).padding(top = 12.dp))
    }
}

@Composable
private fun ReceiptRule(modifier: Modifier = Modifier) {
    androidx.compose.foundation.Canvas(modifier.fillMaxWidth().height(1.dp)) {
        drawLine(
            color = Color.Black.copy(alpha = 0.24f),
            start = Offset(0f, size.height / 2),
            end = Offset(size.width, size.height / 2),
            strokeWidth = 1f,
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f)),
        )
    }
}

/** 小票锯齿底边（对齐 iOS ReceiptPaperShape）。 */
private class ReceiptPaperShape : Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: androidx.compose.ui.unit.LayoutDirection,
        density: androidx.compose.ui.unit.Density,
    ): androidx.compose.ui.graphics.Outline {
        val toothWidth = 8 * density.density
        val toothDepth = 5 * density.density
        val path = Path().apply {
            moveTo(0f, 0f)
            lineTo(size.width, 0f)
            lineTo(size.width, size.height - toothDepth)
            var x = size.width
            var down = true
            while (x > 0f) {
                x = (x - toothWidth / 2).coerceAtLeast(0f)
                lineTo(x, if (down) size.height else size.height - toothDepth)
                down = !down
            }
            lineTo(0f, 0f)
            close()
        }
        return androidx.compose.ui.graphics.Outline.Generic(path)
    }
}

/** 装饰性条形码（对齐 iOS ReceiptBarcode 的固定宽度序列）。 */
@Composable
private fun ReceiptBarcode(modifier: Modifier = Modifier) {
    val widths = listOf(2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 1, 2)
    androidx.compose.foundation.Canvas(modifier) {
        val total = widths.sum() + (widths.size - 1)
        val unit = size.width / total
        var x = 0f
        widths.forEach { w ->
            drawRect(
                color = Color(38 / 255f, 38 / 255f, 42 / 255f),
                topLeft = Offset(x, 0f),
                size = androidx.compose.ui.geometry.Size(w * unit, size.height),
            )
            x += (w + 1) * unit
        }
    }
}

/** 测量内容高度并回调（像素）。 */
private fun Modifier.onGloballyPositionedReceipt(onHeight: (Float) -> Unit): Modifier =
    this.onGloballyPositioned { coordinates -> onHeight(coordinates.size.height.toFloat()) }
