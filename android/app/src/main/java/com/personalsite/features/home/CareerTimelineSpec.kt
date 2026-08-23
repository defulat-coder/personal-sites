package com.personalsite.features.home

import kotlin.math.floor

/** 职业时间线的纯逻辑部分（对齐 iOS CareerTimelineView 的 static 成员）。 */
object CareerTimelineSpec {
    val years = listOf("2014", "2019", "2023", "2026")
    const val FONT_SIZE = 12.2
    val arrowCount get() = years.size - 1
    const val RUNNER_WIDTH = 18f
    const val RUNNER_HEIGHT = 20f
    const val STAGE_HEIGHT = 22f
    const val JOURNEY_DURATION_SECONDS = 3.2

    private val opacities = listOf(0.46, 0.62, 0.78, 1.0)

    fun opacity(index: Int): Double =
        opacities[index.coerceIn(0, opacities.size - 1)]

    fun runnerCenterX(progress: Float, width: Float): Float {
        val clamped = progress.coerceIn(0f, 1f)
        return -RUNNER_WIDTH / 2 + clamped * (width + RUNNER_WIDTH)
    }

    fun shouldRenderRunner(shouldAnimateEntrance: Boolean, reduceMotion: Boolean): Boolean =
        shouldAnimateEntrance && !reduceMotion
}

/** 奔跑小人骨骼关键帧（对齐 iOS HumanRunPose）；24×26 画布坐标系。 */
data class HumanRunPose(
    val head: Pair<Float, Float>,
    val neck: Pair<Float, Float>,
    val shoulder: Pair<Float, Float>,
    val hip: Pair<Float, Float>,
    val armAElbow: Pair<Float, Float>,
    val armAWrist: Pair<Float, Float>,
    val armBElbow: Pair<Float, Float>,
    val armBWrist: Pair<Float, Float>,
    val legAKnee: Pair<Float, Float>,
    val legAAnkle: Pair<Float, Float>,
    val legAToe: Pair<Float, Float>,
    val legBKnee: Pair<Float, Float>,
    val legBAnkle: Pair<Float, Float>,
    val legBToe: Pair<Float, Float>,
) {
    val swappedSides: HumanRunPose
        get() = HumanRunPose(
            head = head, neck = neck, shoulder = shoulder, hip = hip,
            armAElbow = armBElbow, armAWrist = armBWrist,
            armBElbow = armAElbow, armBWrist = armAWrist,
            legAKnee = legBKnee, legAAnkle = legBAnkle, legAToe = legBToe,
            legBKnee = legAKnee, legBAnkle = legAAnkle, legBToe = legAToe,
        )

    companion object {
        const val CANVAS_WIDTH = 24f
        const val CANVAS_HEIGHT = 26f
        const val CYCLE_DURATION_SECONDS = 0.72

        private val keyframes: List<HumanRunPose> = run {
            val firstHalf = listOf(
                HumanRunPose(
                    head = 14.6f to 3.6f, neck = 13.4f to 6.0f, shoulder = 12.0f to 7.5f,
                    hip = 10.1f to 13.2f,
                    armAElbow = 8.5f to 9.3f, armAWrist = 6.5f to 12.6f,
                    armBElbow = 15.3f to 8.6f, armBWrist = 17.8f to 11.0f,
                    legAKnee = 15.4f to 16.2f, legAAnkle = 20.1f to 21.6f, legAToe = 22.7f to 21.9f,
                    legBKnee = 6.4f to 16.2f, legBAnkle = 3.1f to 13.1f, legBToe = 1.0f to 13.3f,
                ),
                HumanRunPose(
                    head = 14.5f to 4.4f, neck = 13.3f to 6.8f, shoulder = 11.9f to 8.2f,
                    hip = 10.2f to 14.1f,
                    armAElbow = 8.8f to 10.3f, armAWrist = 7.2f to 13.5f,
                    armBElbow = 15.4f to 9.4f, armBWrist = 18.0f to 11.7f,
                    legAKnee = 14.5f to 17.6f, legAAnkle = 19.0f to 22.1f, legAToe = 22.0f to 22.2f,
                    legBKnee = 6.2f to 16.9f, legBAnkle = 2.8f to 14.4f, legBToe = 0.7f to 14.5f,
                ),
                HumanRunPose(
                    head = 14.6f to 3.4f, neck = 13.4f to 5.9f, shoulder = 12.1f to 7.4f,
                    hip = 10.3f to 13.0f,
                    armAElbow = 12.8f to 10.0f, armAWrist = 15.1f to 11.4f,
                    armBElbow = 9.1f to 9.7f, armBWrist = 7.0f to 12.4f,
                    legAKnee = 8.0f to 17.0f, legAAnkle = 4.2f to 20.9f, legAToe = 1.8f to 21.0f,
                    legBKnee = 14.3f to 14.9f, legBAnkle = 12.0f to 18.3f, legBToe = 14.4f to 18.5f,
                ),
                HumanRunPose(
                    head = 14.7f to 2.8f, neck = 13.5f to 5.3f, shoulder = 12.2f to 6.9f,
                    hip = 10.4f to 12.4f,
                    armAElbow = 15.2f to 7.9f, armAWrist = 17.3f to 10.5f,
                    armBElbow = 8.3f to 8.5f, armBWrist = 6.3f to 11.5f,
                    legAKnee = 6.3f to 15.2f, legAAnkle = 2.2f to 17.9f, legAToe = 0.4f to 18.0f,
                    legBKnee = 15.7f to 14.0f, legBAnkle = 18.2f to 17.3f, legBToe = 20.9f to 17.6f,
                ),
            )
            firstHalf + firstHalf.map { it.swappedSides }
        }

        fun sample(phase: Double): HumanRunPose {
            val count = keyframes.size
            val wrapped = phase - floor(phase)
            val position = wrapped * count
            val index = floor(position).toInt() % count
            val amount = (position - floor(position)).toFloat()
            return interpolate(
                keyframes[(index - 1 + count) % count],
                keyframes[index],
                keyframes[(index + 1) % count],
                keyframes[(index + 2) % count],
                amount,
            )
        }

        private fun interpolate(
            previous: HumanRunPose,
            start: HumanRunPose,
            end: HumanRunPose,
            next: HumanRunPose,
            amount: Float,
        ): HumanRunPose = HumanRunPose(
            head = catmullRom(previous.head, start.head, end.head, next.head, amount),
            neck = catmullRom(previous.neck, start.neck, end.neck, next.neck, amount),
            shoulder = catmullRom(previous.shoulder, start.shoulder, end.shoulder, next.shoulder, amount),
            hip = catmullRom(previous.hip, start.hip, end.hip, next.hip, amount),
            armAElbow = catmullRom(previous.armAElbow, start.armAElbow, end.armAElbow, next.armAElbow, amount),
            armAWrist = catmullRom(previous.armAWrist, start.armAWrist, end.armAWrist, next.armAWrist, amount),
            armBElbow = catmullRom(previous.armBElbow, start.armBElbow, end.armBElbow, next.armBElbow, amount),
            armBWrist = catmullRom(previous.armBWrist, start.armBWrist, end.armBWrist, next.armBWrist, amount),
            legAKnee = catmullRom(previous.legAKnee, start.legAKnee, end.legAKnee, next.legAKnee, amount),
            legAAnkle = catmullRom(previous.legAAnkle, start.legAAnkle, end.legAAnkle, next.legAAnkle, amount),
            legAToe = catmullRom(previous.legAToe, start.legAToe, end.legAToe, next.legAToe, amount),
            legBKnee = catmullRom(previous.legBKnee, start.legBKnee, end.legBKnee, next.legBKnee, amount),
            legBAnkle = catmullRom(previous.legBAnkle, start.legBAnkle, end.legBAnkle, next.legBAnkle, amount),
            legBToe = catmullRom(previous.legBToe, start.legBToe, end.legBToe, next.legBToe, amount),
        )

        private fun catmullRom(
            previous: Pair<Float, Float>,
            start: Pair<Float, Float>,
            end: Pair<Float, Float>,
            next: Pair<Float, Float>,
            amount: Float,
        ): Pair<Float, Float> =
            catmullRom(previous.first, start.first, end.first, next.first, amount) to
                catmullRom(previous.second, start.second, end.second, next.second, amount)

        private fun catmullRom(
            previous: Float,
            start: Float,
            end: Float,
            next: Float,
            amount: Float,
        ): Float {
            val squared = amount * amount
            val cubed = squared * amount
            return 0.5f * (
                (2 * start) +
                    (-previous + end) * amount +
                    (2 * previous - 5 * start + 4 * end - next) * squared +
                    (-previous + 3 * start - 3 * end + next) * cubed
                )
        }
    }
}
