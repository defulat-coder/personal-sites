import CoreGraphics
import Foundation

/// 信号场词条与滚动参数，逐项对齐 components/interactive-dot-field.tsx 与
/// globals.css 的 technical-term-marquee 关键帧。所有参数都是索引的纯函数，
/// 不引入任何随机或时间种子。
enum SignalFieldTerms {
    static let technicalTermSets: [[String]] = [
        [
            "agent.runtime", "multi.agent", "workflow.graph", "tool.call()",
            "mcp.protocol", "skills.registry", "prompt.ops", "context.engine",
            "observe.trace", "eval.loop", "rag.retrieval", "vector.search",
        ],
        [
            "sse.stream", "ship.systems", "code.diff", "session.state",
            "planner.agent", "executor.agent", "router.policy", "memory.store",
            "context.window", "model.gateway", "structured.output", "function.calling",
        ],
        [
            "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
            "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
            "function.calling", "eval.loop", "context.engine", "ship.systems",
        ],
        [
            "workflow.graph", "mcp.protocol", "skills.registry", "prompt.ops",
            "vector.search", "code.diff", "session.state", "executor.agent",
            "router.policy", "context.window", "model.gateway", "structured.output",
        ],
    ]

    /// 技术栈词条：前半复刻 aryankarma.com 的 Skills 列表，后半为国内常用的 Java 技术栈。
    static let techStackTerms: [String] = [
        "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
        "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
        "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
        "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
        "Maven", "Nginx",
    ]

    /// 对齐 TS 的 selectTechnicalTerms：randomValue 归一化后取整选组。
    static func selectTechnicalTerms(_ randomValue: Double) -> [String] {
        let normalized = randomValue.isFinite
            ? min(max(randomValue, 0), 1 - Double.ulpOfOne)
            : 0
        return technicalTermSets[Int(normalized * Double(technicalTermSets.count))]
    }

    /// 与 Web 相同的固定种子：SELECTED_TERMS = selectTechnicalTerms(0.61) + TECH_STACK_TERMS。
    static let selectedTerms: [String] = selectTechnicalTerms(0.61) + techStackTerms

    struct Lane {
        /// 泳道顶边占信号区的比例（0.02 / 0.19 / ... / 0.84）。
        let topFraction: Double
        /// 单次划过基准时长（秒）；实际周期 = baseDuration × subgroupCount。
        let baseDuration: Double
    }

    static let lanes: [Lane] = [
        Lane(topFraction: 0.02, baseDuration: 21),
        Lane(topFraction: 0.19, baseDuration: 23),
        Lane(topFraction: 0.36, baseDuration: 20),
        Lane(topFraction: 0.52, baseDuration: 27),
        Lane(topFraction: 0.68, baseDuration: 24),
        Lane(topFraction: 0.84, baseDuration: 22),
    ]

    /// 每条泳道内再分组轮换入场，同屏词条数约为总数的 1/subgroupCount。
    static let subgroupCount = 3

    struct Track: Equatable {
        let lane: Int
        let topFraction: Double
        /// 动画周期（秒）= baseDuration × subgroupCount。
        let duration: Double
        /// CSS 负 delay（秒）：开播时仿佛已在途中。
        let delay: Double
        /// 纵向漂移幅度（pt；Web 单位 rem，按 16px 换算）。
        let drift: Double
        let opacity: Double
    }

    /// 对齐 TS 的 trackStyle：同组词条等相位差，组间错开一个完整划过窗口，
    /// 任意时刻同泳道词条互不重叠。
    static func track(index: Int, total: Int) -> Track {
        let lane = index % lanes.count
        let order = index / lanes.count
        let laneSize = total / lanes.count + (lane < total % lanes.count ? 1 : 0)
        let subgroup = order % subgroupCount
        let slot = order / subgroupCount
        let subgroupSize = laneSize / subgroupCount + (subgroup < laneSize % subgroupCount ? 1 : 0)
        let laneSpec = lanes[lane]
        let delay = -(Double(subgroup) * laneSpec.baseDuration
            + (Double(slot) / Double(subgroupSize)) * laneSpec.baseDuration
            + Double(lane) * 1.7)
        let drift = (index % 2 == 0 ? 1.0 : -1.0) * (0.06 + Double(index % 3) * 0.03) * 16
        let opacity = 0.62 + Double((index * 7) % 5) * 0.075
        return Track(
            lane: lane,
            topFraction: laneSpec.topFraction,
            duration: laneSpec.baseDuration * Double(subgroupCount),
            delay: delay,
            drift: drift,
            opacity: opacity
        )
    }

    /// 词条样式分级，对齐 globals.css 的 __track:nth-child(1/5/9) 规则。
    static func fontSize(forIndex index: Int) -> Double {
        switch index {
        case 0: return 11.5 // .72rem
        case 4: return 10.9 // .68rem
        case 8: return 11.2 // .7rem
        default: return 9.6 // .6rem
        }
    }

    static func borderAlpha(forIndex index: Int) -> Double {
        switch index {
        case 0, 8: return 0.42
        case 4: return 0.36
        default: return 0.22
        }
    }

    struct MarqueeFrame: Equatable {
        /// 词条左边沿相对信号区左缘的 x（pt）。
        let x: Double
        let opacity: Double
        /// 纵向漂移偏移（pt）。
        let yOffset: Double
    }

    /// 对齐 @keyframes technical-term-marquee：划过只占周期前 1/3，
    /// 之后停在屏外隐藏。progress ∈ [0, 1)，width 为信号区宽度（pt），
    /// drift 为该词条的纵向漂移幅度（pt，见 Track.drift）。
    static func marqueeFrame(progress: Double, width: Double, drift: Double) -> MarqueeFrame {
        let p = min(max(progress, 0), 1)
        let startX = width + 56 // 100% + 3.5rem
        let midX = width * 0.5 - 68 // 50% - 4.25rem
        let endX = -192.0 // -12rem

        let x: Double
        if p < 0.16 {
            x = startX + (midX - startX) * (p / 0.16)
        } else if p < 0.3334 {
            x = midX + (endX - midX) * ((p - 0.16) / (0.3334 - 0.16))
        } else {
            x = endX
        }

        let opacity: Double
        if p < 0.0267 {
            opacity = p / 0.0267
        } else if p < 0.2867 {
            opacity = 1
        } else if p < 0.3067 {
            opacity = 1 - (p - 0.2867) / (0.3067 - 0.2867)
        } else {
            opacity = 0
        }

        // 漂移系数 [-1, 1]：0% 时 +1，16% 时 -1，33.34% 回到 +1，之后保持。
        let driftPhase: Double
        if p < 0.16 {
            driftPhase = 1 - 2 * (p / 0.16)
        } else if p < 0.3334 {
            driftPhase = -1 + 2 * ((p - 0.16) / (0.3334 - 0.16))
        } else {
            driftPhase = 1
        }

        return MarqueeFrame(x: x, opacity: opacity, yOffset: driftPhase * drift)
    }

    /// 由开播时刻与词条 delay 计算当前相位。
    static func progress(elapsed: Double, track: Track) -> Double {
        let local = (elapsed - track.delay).truncatingRemainder(dividingBy: track.duration)
        return local / track.duration
    }
}
