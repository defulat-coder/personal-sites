package com.personalsite.features.support

import android.annotation.SuppressLint
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.personalsite.core.PSColors
import kotlinx.coroutines.delay

/**
 * 可选的首次欢迎动画（对齐 iOS WelcomeAnimationView）：主页已在下层完成渲染，可随时跳过。
 * 电池五格节拍 [0.45,1.4,2.35,3.3,4.25]s，颜色沿 4.7s 主线红→黄→绿；
 * 4.48s 电池 1→1.08→1 回弹；5s 后退出。
 * 角色是 SMIL 逐帧 SVG（100 帧 / 50ms），Compose 不能直接渲染，用 WebView 加载以保真。
 */
@Composable
fun WelcomeAnimationView(reduceMotion: Boolean, onFinished: () -> Unit) {
    val dark = isSystemInDarkTheme()
    var startNanos by remember { mutableLongStateOf(-1L) }
    var elapsed by remember { mutableStateOf(0.0) }
    var didFinish by remember { mutableStateOf(false) }

    fun start() {
        if (startNanos < 0) startNanos = System.nanoTime()
    }

    fun finish() {
        if (!didFinish) {
            didFinish = true
            onFinished()
        }
    }

    LaunchedEffect(reduceMotion) {
        if (reduceMotion) {
            startNanos = System.nanoTime() - (5000L * 1_000_000)
            delay(200)
            finish()
        } else {
            // 与 Web 一致：SVG 未就绪时 1.2s 兜底开播。
            delay(1200)
            if (startNanos < 0) start()
        }
    }

    LaunchedEffect(startNanos >= 0, didFinish) {
        if (startNanos < 0 || didFinish || reduceMotion) return@LaunchedEffect
        while (true) {
            withFrameNanos {
                elapsed = (System.nanoTime() - startNanos) / 1_000_000_000.0
                if (elapsed >= REVEAL_AT) {
                    finish()
                    return@withFrameNanos
                }
            }
            if (didFinish) break
        }
    }

    Box(Modifier.fillMaxSize()) {
        Box(
            Modifier
                .fillMaxSize()
                .background(if (dark) PSColors.surface else Color.White)
                .alpha(if (startNanos < 0) 0f else 1f)
        ) {
            Column(Modifier.fillMaxSize()) {
                Spacer(Modifier.weight(1f))
                Box(
                    Modifier.align(Alignment.CenterHorizontally),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    LoaderCharacterView(
                        onLoaded = { start() },
                        modifier = Modifier
                            .width(132.dp)
                            .height((132 * 685.0 / 700.0).dp),
                    )
                    BatteryView(
                        elapsed = elapsed,
                        modifier = Modifier
                            .width(52.dp)
                            .height(18.dp)
                            .scale(batteryScale(elapsed))
                            .offset(y = ((132 * 685.0 / 700.0) * 0.03 - 2).dp),
                    )
                }
                Spacer(Modifier.weight(1f))
            }
        }
        Text(
            "跳过",
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = PSColors.ink,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 8.dp, end = 8.dp)
                .clickable { finish() }
                .padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

private val CELL_DELAYS = listOf(0.45, 1.4, 2.35, 3.3, 4.25)
private const val COLOR_DURATION = 4.7
private const val BOUNCE_START = 4.48
private const val BOUNCE_DURATION = 0.42
private const val REVEAL_AT = 5.0

/** 电池：外框 + 5 格 + 正极头，尺寸按 globals.css 的 rem 值换算（1rem = 16dp）。 */
@Composable
private fun BatteryView(elapsed: Double, modifier: Modifier = Modifier) {
    Row(modifier) {
        Row(
            Modifier
                .weight(1f)
                .height(18.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(Color.White)
                .padding(2.5.dp),
        ) {
            CELL_DELAYS.forEachIndexed { index, delay ->
                val lit = elapsed >= delay
                Box(
                    Modifier
                        .weight(1f)
                        .height(13.dp)
                        .padding(horizontal = 1.dp)
                        .scale(scaleY = if (lit) 1f else 0.55f, scaleX = 1f)
                        .alpha(if (lit) 1f else 0f)
                        .clip(RoundedCornerShape(1.5.dp))
                        .background(batteryCellColor(elapsed))
                )
            }
        }
        // 正极头
        Box(
            Modifier
                .align(Alignment.CenterVertically)
                .width(3.dp)
                .height(7.dp)
                .background(PSColors.batteryStroke)
        )
    }
}

/** 颜色沿全局 4.7s 主线插值：红(0) → 红(0.18) → 黄(0.52) → 绿(1)。 */
private fun batteryCellColor(elapsed: Double): Color {
    val t = (elapsed / COLOR_DURATION).coerceIn(0.0, 1.0)
    return when {
        t < 0.18 -> PSColors.batteryRed
        t < 0.52 -> lerpColor(PSColors.batteryRed, PSColors.batteryYellow, (t - 0.18) / 0.34)
        else -> lerpColor(PSColors.batteryYellow, PSColors.batteryGreen, (t - 0.52) / 0.48)
    }
}

private fun lerpColor(from: Color, to: Color, fraction: Double): Color {
    val f = fraction.toFloat()
    return Color(
        red = from.red + (to.red - from.red) * f,
        green = from.green + (to.green - from.green) * f,
        blue = from.blue + (to.blue - from.blue) * f,
        alpha = 1f,
    )
}

/** 回弹签名：4.48s 起 1→1.08→1，0.42s，ease [0.34,1.56,0.64,1]，关键帧 [0,0.55,1]。 */
private fun batteryScale(elapsed: Double): Float {
    if (elapsed < BOUNCE_START) return 1f
    val t = ((elapsed - BOUNCE_START) / BOUNCE_DURATION).coerceAtMost(1.0)
    val easing = CubicBezierEasing(0.34, 1.56, 0.64, 1.0)
    val scale = if (t <= 0.55) {
        1 + 0.08 * easing.evaluate(t / 0.55)
    } else {
        1.08 - 0.08 * easing.evaluate((t - 0.55) / 0.45)
    }
    return scale.toFloat()
}

/** 角色插画：WebView 加载 assets 内的 SMIL 逐帧 SVG，透明背景、禁滚动禁交互。 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun LoaderCharacterView(onLoaded: () -> Unit, modifier: Modifier = Modifier) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                settings.loadWithOverviewMode = true
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                setOnTouchListener { _, _ -> true }
                webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        onLoaded()
                    }
                }
                val html = """
                    <!doctype html><html><head><meta name="viewport" content="initial-scale=1">
                    <style>html,body{margin:0;background:transparent}img{display:block;width:100%;height:100%}</style>
                    </head><body><img src="ample-loader-sequence.svg" alt=""></body></html>
                """.trimIndent()
                loadDataWithBaseURL("file:///android_asset/", html, "text/html", "utf-8", null)
            }
        },
    )
}

/** 三次贝塞尔缓动求值（牛顿迭代 + 二分兜底），用于复刻 Web 的 cubic-bezier 签名。 */
class CubicBezierEasing(
    private val x1: Double,
    private val y1: Double,
    private val x2: Double,
    private val y2: Double,
) {
    /** 输入时间 x ∈ [0,1]，输出进度 y。 */
    fun evaluate(x: Double): Double {
        if (x <= 0 || x >= 1) return x
        var t = x
        repeat(8) {
            val cx = sample(x1, x2, t) - x
            if (kotlin.math.abs(cx) < 1e-6) return sample(y1, y2, t)
            val dx = sampleDerivative(x1, x2, t)
            if (kotlin.math.abs(dx) < 1e-6) return@repeat
            t -= cx / dx
        }
        var lo = 0.0
        var hi = 1.0
        t = t.coerceIn(lo, hi)
        while (lo < hi) {
            val cx = sample(x1, x2, t)
            if (kotlin.math.abs(cx - x) < 1e-6) break
            if (cx < x) lo = t else hi = t
            t = (lo + hi) / 2
        }
        return sample(y1, y2, t)
    }

    companion object {
        /** B(t) = 3a(1-t)²t + 3b(1-t)t² + t³ */
        private fun sample(a: Double, b: Double, t: Double): Double =
            3 * a * (1 - t) * (1 - t) * t + 3 * b * (1 - t) * t * t + t * t * t

        /** B'(t) = 3a(1-t)(1-3t) + 3b·t(2-3t) + 3t² */
        private fun sampleDerivative(a: Double, b: Double, t: Double): Double =
            3 * a * (1 - t) * (1 - 3 * t) + 3 * b * t * (2 - 3 * t) + 3 * t * t
    }
}
