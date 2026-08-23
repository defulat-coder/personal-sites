package com.personalsite.features.home

import kotlin.math.max
import kotlin.math.min

/**
 * 信号场词条与滚动参数，逐项对齐 components/interactive-dot-field.tsx 与
 * globals.css 的 technical-term-marquee 关键帧。所有参数都是索引的纯函数，
 * 不引入任何随机或时间种子。
 */
object SignalFieldTerms {
    val technicalTermSets: List<List<String>> = listOf(
        listOf(
            "agent.runtime", "multi.agent", "workflow.graph", "tool.call()",
            "mcp.protocol", "skills.registry", "prompt.ops", "context.engine",
            "observe.trace", "eval.loop", "rag.retrieval", "vector.search",
        ),
        listOf(
            "sse.stream", "ship.systems", "code.diff", "session.state",
            "planner.agent", "executor.agent", "router.policy", "memory.store",
            "context.window", "model.gateway", "structured.output", "function.calling",
        ),
        listOf(
            "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
            "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
            "function.calling", "eval.loop", "context.engine", "ship.systems",
        ),
        listOf(
            "workflow.graph", "mcp.protocol", "skills.registry", "prompt.ops",
            "vector.search", "code.diff", "session.state", "executor.agent",
            "router.policy", "context.window", "model.gateway", "structured.output",
        ),
    )

    /** 技术栈词条：前半复刻 aryankarma.com 的 Skills 列表，后半为国内常用的 Java 技术栈。 */
    val techStackTerms: List<String> = listOf(
        "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
        "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
        "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
        "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
        "Maven", "Nginx",
    )

    /** 对齐 TS 的 selectTechnicalTerms：randomValue 归一化后取整选组。 */
    fun selectTechnicalTerms(randomValue: Double): List<String> {
        val normalized = if (randomValue.isFinite()) {
            min(max(randomValue, 0.0), Math.nextDown(1.0))
        } else {
            0.0
        }
        return technicalTermSets[(normalized * technicalTermSets.size).toInt()]
    }

    /** 与 Web 相同的固定种子：SELECTED_TERMS = selectTechnicalTerms(0.61) + TECH_STACK_TERMS。 */
    val selectedTerms: List<String> = selectTechnicalTerms(0.61) + techStackTerms

    data class Lane(
        /** 泳道顶边占信号区的比例（0.02 / 0.19 / ... / 0.84）。 */
        val topFraction: Double,
        /** 单次划过基准时长（秒）；实际周期 = baseDuration × subgroupCount。 */
        val baseDuration: Double,
    )

    val lanes: List<Lane> = listOf(
        Lane(topFraction = 0.02, baseDuration = 21.0),
        Lane(topFraction = 0.19, baseDuration = 23.0),
        Lane(topFraction = 0.36, baseDuration = 20.0),
        Lane(topFraction = 0.52, baseDuration = 27.0),
        Lane(topFraction = 0.68, baseDuration = 24.0),
        Lane(topFraction = 0.84, baseDuration = 22.0),
    )

    /** 每条泳道内再分组轮换入场，同屏词条数约为总数的 1/subgroupCount。 */
    const val subgroupCount = 3

    data class Track(
        val lane: Int,
        val topFraction: Double,
        /** 动画周期（秒）= baseDuration × subgroupCount。 */
        val duration: Double,
        /** CSS 负 delay（秒）：开播时仿佛已在途中。 */
        val delay: Double,
        /** 纵向漂移幅度（dp；Web 单位 rem，按 16px 换算）。 */
        val drift: Double,
        val opacity: Double,
    )

    /**
     * 对齐 TS 的 trackStyle：同组词条等相位差，组间错开一个完整划过窗口，
     * 任意时刻同泳道词条互不重叠。
     */
    fun track(index: Int, total: Int): Track {
        val lane = index % lanes.size
        val order = index / lanes.size
        val laneSize = total / lanes.size + if (lane < total % lanes.size) 1 else 0
        val subgroup = order % subgroupCount
        val slot = order / subgroupCount
        val subgroupSize = laneSize / subgroupCount + if (subgroup < laneSize % subgroupCount) 1 else 0
        val laneSpec = lanes[lane]
        val delay = -(
            subgroup * laneSpec.baseDuration +
                (slot.toDouble() / subgroupSize) * laneSpec.baseDuration +
                lane * 1.7
            )
        val drift = (if (index % 2 == 0) 1.0 else -1.0) * (0.06 + (index % 3) * 0.03) * 16
        val opacity = 0.62 + ((index * 7) % 5) * 0.075
        return Track(
            lane = lane,
            topFraction = laneSpec.topFraction,
            duration = laneSpec.baseDuration * subgroupCount,
            delay = delay,
            drift = drift,
            opacity = opacity,
        )
    }

    /** 词条样式分级，对齐 globals.css 的 __track:nth-child(1/5/9) 规则。 */
    fun fontSize(forIndex: Int): Double = when (forIndex) {
        0 -> 11.5 // .72rem
        4 -> 10.9 // .68rem
        8 -> 11.2 // .7rem
        else -> 9.6 // .6rem
    }

    fun borderAlpha(forIndex: Int): Double = when (forIndex) {
        0, 8 -> 0.42
        4 -> 0.36
        else -> 0.22
    }

    data class MarqueeFrame(
        /** 词条左边沿相对信号区左缘的 x（dp）。 */
        val x: Double,
        val opacity: Double,
        /** 纵向漂移偏移（dp）。 */
        val yOffset: Double,
    )

    /**
     * 对齐 @keyframes technical-term-marquee：划过只占周期前 1/3，
     * 之后停在屏外隐藏。progress ∈ [0, 1)，width 为信号区宽度（dp），
     * drift 为该词条的纵向漂移幅度（dp，见 Track.drift）。
     */
    fun marqueeFrame(progress: Double, width: Double, drift: Double): MarqueeFrame {
        val p = min(max(progress, 0.0), 1.0)
        val startX = width + 56 // 100% + 3.5rem
        val midX = width * 0.5 - 68 // 50% - 4.25rem
        val endX = -192.0 // -12rem

        val x = when {
            p < 0.16 -> startX + (midX - startX) * (p / 0.16)
            p < 0.3334 -> midX + (endX - midX) * ((p - 0.16) / (0.3334 - 0.16))
            else -> endX
        }

        val opacity = when {
            p < 0.0267 -> p / 0.0267
            p < 0.2867 -> 1.0
            p < 0.3067 -> 1 - (p - 0.2867) / (0.3067 - 0.2867)
            else -> 0.0
        }

        // 漂移系数 [-1, 1]：0% 时 +1，16% 时 -1，33.34% 回到 +1，之后保持。
        val driftPhase = when {
            p < 0.16 -> 1 - 2 * (p / 0.16)
            p < 0.3334 -> -1 + 2 * ((p - 0.16) / (0.3334 - 0.16))
            else -> 1.0
        }

        return MarqueeFrame(x = x, opacity = opacity, yOffset = driftPhase * drift)
    }

    /** 由开播时刻与词条 delay 计算当前相位。 */
    fun progress(elapsed: Double, track: Track): Double {
        val local = (elapsed - track.delay) % track.duration
        return local / track.duration
    }
}
