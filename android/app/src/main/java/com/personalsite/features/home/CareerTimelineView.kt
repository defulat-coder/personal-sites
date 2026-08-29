package com.personalsite.features.home

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.core.PSColors
import kotlinx.coroutines.delay
import kotlin.math.min

/**
 * 职业时间线（对齐 iOS CareerTimelineView）：四个年份标签 + 跑步小人入场跑完全程。
 * 标签被小人经过的位置逐渐点亮（mask 效果）。
 */
@Composable
fun CareerTimelineView(
    shouldAnimateEntrance: Boolean,
    reduceMotion: Boolean,
    onEntranceCompleted: () -> Unit,
) {
    var startNanos by remember { mutableLongStateOf(-1L) }
    var clockSeconds by remember { mutableStateOf(0.0) }
    val animating = shouldAnimateEntrance && !reduceMotion && startNanos >= 0

    LaunchedEffect(shouldAnimateEntrance, reduceMotion) {
        if (reduceMotion || !shouldAnimateEntrance) {
            startNanos = -1L
            return@LaunchedEffect
        }
        startNanos = System.nanoTime()
        delay((CareerTimelineSpec.JOURNEY_DURATION_SECONDS * 1000).toLong())
        onEntranceCompleted()
    }

    LaunchedEffect(animating) {
        if (!animating) return@LaunchedEffect
        while (true) {
            withFrameNanos {
                clockSeconds = (System.nanoTime() - startNanos) / 1_000_000_000.0
            }
        }
    }

    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(CareerTimelineSpec.STAGE_HEIGHT.dp)
    ) {
        val widthPx = constraints.maxWidth.toFloat()
        val widthDp = with(androidx.compose.ui.platform.LocalDensity.current) { constraints.maxWidth.toDp().value }

        val progress = when {
            reduceMotion || !shouldAnimateEntrance -> 1f
            startNanos < 0 -> 0f
            else -> (clockSeconds / CareerTimelineSpec.JOURNEY_DURATION_SECONDS)
                .toFloat().coerceIn(0f, 1f)
        }
        val runnerX = CareerTimelineSpec.runnerCenterX(progress, widthDp)

        // 年份标签：小人经过的左侧部分点亮（对齐 iOS 的 mask 揭示效果）
        Box(
            Modifier
                .fillMaxWidth()
                .clip(BoundsClipper { (runnerX - 3).coerceIn(0f, widthDp) })
        ) {
            TimelineLabels()
        }

        if (CareerTimelineSpec.shouldRenderRunner(shouldAnimateEntrance, reduceMotion) && startNanos >= 0) {
            val runPhase = if (reduceMotion) 0.0 else
                (clockSeconds % HumanRunPose.CYCLE_DURATION_SECONDS) / HumanRunPose.CYCLE_DURATION_SECONDS
            Canvas(
                Modifier
                    .width(CareerTimelineSpec.RUNNER_WIDTH.dp)
                    .height(CareerTimelineSpec.RUNNER_HEIGHT.dp)
                    .offset(x = (runnerX - CareerTimelineSpec.RUNNER_WIDTH / 2).dp)
            ) {
                drawHumanRunner(HumanRunPose.sample(runPhase))
            }
        }
    }
}

/** 按右边界裁剪的 Shape（点亮层 mask）。 */
private class BoundsClipper(private val rightDp: () -> Float) : androidx.compose.ui.graphics.Shape {
    override fun createOutline(
        size: androidx.compose.ui.geometry.Size,
        layoutDirection: androidx.compose.ui.unit.LayoutDirection,
        density: androidx.compose.ui.unit.Density,
    ): androidx.compose.ui.graphics.Outline {
        val rightPx = rightDp() * density.density
        return androidx.compose.ui.graphics.Outline.Rectangle(
            Rect(0f, 0f, rightPx.coerceIn(0f, size.width), size.height)
        )
    }
}

@Composable
private fun TimelineLabels() {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(end = 18.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        CareerTimelineSpec.years.forEachIndexed { index, year ->
            val opacity = CareerTimelineSpec.opacity(index)
            Text(
                text = year,
                fontSize = CareerTimelineSpec.FONT_SIZE.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace,
                color = PSColors.ink.copy(alpha = opacity.toFloat()),
                modifier = if (year == CareerTimelineSpec.years.last()) Modifier.padding(bottom = 1.5.dp) else Modifier,
            )
            if (year != CareerTimelineSpec.years.last()) {
                Spacer(Modifier.width(4.dp))
                Text(
                    text = "→",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    color = PSColors.ink.copy(alpha = opacity.toFloat()),
                )
                Spacer(Modifier.width(4.dp))
            }
        }
    }
}

/** 奔跑小人绘制（对齐 iOS HumanRunnerView 的 Canvas 逻辑）。 */
private fun DrawScope.drawHumanRunner(pose: HumanRunPose) {
    val scale = min(
        size.width / HumanRunPose.CANVAS_WIDTH,
        size.height / HumanRunPose.CANVAS_HEIGHT,
    )
    val origin = Offset(
        (size.width - HumanRunPose.CANVAS_WIDTH * scale) / 2,
        (size.height - HumanRunPose.CANVAS_HEIGHT * scale) / 2,
    )
    val ink = androidx.compose.ui.graphics.Color(0xFF1C1C1E)

    fun transform(point: Pair<Float, Float>): Offset =
        Offset(origin.x + point.first * scale, origin.y + point.second * scale)

    fun drawSegment(start: Pair<Float, Float>, end: Pair<Float, Float>, width: Float, color: androidx.compose.ui.graphics.Color) {
        drawLine(
            color = color,
            start = transform(start),
            end = transform(end),
            strokeWidth = width * scale,
            cap = androidx.compose.ui.graphics.StrokeCap.Round,
        )
    }

    fun drawJoint(point: Pair<Float, Float>, radius: Float, color: androidx.compose.ui.graphics.Color) {
        drawCircle(color = color, radius = radius * scale, center = transform(point))
    }

    fun drawArm(shoulder: Pair<Float, Float>, elbow: Pair<Float, Float>, wrist: Pair<Float, Float>, color: androidx.compose.ui.graphics.Color) {
        drawSegment(shoulder, elbow, 1.75f, color)
        drawSegment(elbow, wrist, 1.35f, color)
        drawJoint(elbow, 0.8f, color)
        drawJoint(wrist, 0.72f, color)
    }

    fun drawLeg(hip: Pair<Float, Float>, knee: Pair<Float, Float>, ankle: Pair<Float, Float>, toe: Pair<Float, Float>, color: androidx.compose.ui.graphics.Color) {
        drawSegment(hip, knee, 2.35f, color)
        drawSegment(knee, ankle, 1.75f, color)
        drawSegment(ankle, toe, 1.55f, color)
        drawJoint(knee, 1.0f, color)
    }

    // 背侧（淡）
    drawLeg(pose.hip, pose.legBKnee, pose.legBAnkle, pose.legBToe, ink.copy(alpha = 0.62f))
    drawArm(pose.shoulder, pose.armBElbow, pose.armBWrist, ink.copy(alpha = 0.58f))

    // 躯干
    run {
        val shoulder = transform(pose.shoulder)
        val hip = transform(pose.hip)
        val axis = Offset(hip.x - shoulder.x, hip.y - shoulder.y)
        val length = kotlin.math.hypot(axis.x, axis.y).coerceAtLeast(0.001f)
        val normal = Offset(-axis.y / length, axis.x / length)
        val shoulderHalf = 2.15f * scale
        val hipHalf = 1.35f * scale

        fun offset(point: Offset, amount: Float): Offset =
            Offset(point.x + normal.x * amount, point.y + normal.y * amount)

        fun midpoint(a: Offset, b: Offset): Offset = Offset((a.x + b.x) / 2, (a.y + b.y) / 2)

        val torso = Path().apply {
            moveTo(offset(shoulder, shoulderHalf).x, offset(shoulder, shoulderHalf).y)
            quadraticTo(
                offset(midpoint(shoulder, hip), 1.75f * scale).x,
                offset(midpoint(shoulder, hip), 1.75f * scale).y,
                offset(hip, hipHalf).x,
                offset(hip, hipHalf).y,
            )
            quadraticTo(
                hip.x + 0.25f * scale, hip.y + 0.9f * scale,
                offset(hip, -hipHalf).x, offset(hip, -hipHalf).y,
            )
            quadraticTo(
                offset(midpoint(shoulder, hip), -1.55f * scale).x,
                offset(midpoint(shoulder, hip), -1.55f * scale).y,
                offset(shoulder, -shoulderHalf).x,
                offset(shoulder, -shoulderHalf).y,
            )
            close()
        }
        drawPath(torso, color = ink)
        drawSegment(pose.neck, pose.shoulder, 1.9f, ink)
        drawJoint(pose.hip, 1.5f, ink)
    }

    // 前侧
    drawLeg(pose.hip, pose.legAKnee, pose.legAAnkle, pose.legAToe, ink)
    drawArm(pose.shoulder, pose.armAElbow, pose.armAWrist, ink)

    // 头（椭圆 + 脸三角）
    run {
        val center = transform(pose.head)
        val radius = 1.95f * scale
        drawOval(
            color = ink,
            topLeft = Offset(center.x - radius, center.y - radius * 1.08f),
            size = androidx.compose.ui.geometry.Size(radius * 2, radius * 2.16f),
        )
        val face = Path().apply {
            moveTo(center.x + radius * 0.72f, center.y - radius * 0.18f)
            lineTo(center.x + radius * 1.18f, center.y + radius * 0.08f)
            lineTo(center.x + radius * 0.72f, center.y + radius * 0.28f)
            close()
        }
        drawPath(face, color = ink)
    }
}
