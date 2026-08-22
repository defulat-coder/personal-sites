import SwiftUI

struct CareerTimelineView: View {
    var shouldAnimateEntrance: Bool
    var onEntranceCompleted: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var startDate: Date?

    nonisolated static let years = ["2014", "2019", "2023", "2026"]
    nonisolated static let fontSize = 12.2
    nonisolated static let arrowCount = years.count - 1
    nonisolated static let runnerWidth: CGFloat = 18
    nonisolated static let runnerHeight: CGFloat = 20
    nonisolated static let stageHeight: CGFloat = 22
    nonisolated private static let opacities = [0.46, 0.62, 0.78, 1.0]
    private static let journeyDuration = 3.2

    var body: some View {
        TimelineView(.animation(paused: reduceMotion || !shouldAnimateEntrance)) { context in
            GeometryReader { geometry in
                let elapsed = startDate.map { context.date.timeIntervalSince($0) } ?? 0
                let progress = journeyProgress(elapsed: elapsed)
                let runnerX = Self.runnerCenterX(progress: progress, width: geometry.size.width)
                let runPhase = reduceMotion
                    ? 0
                    : context.date.timeIntervalSinceReferenceDate
                        .truncatingRemainder(dividingBy: HumanRunnerView.cycleDuration)
                        / HumanRunnerView.cycleDuration

                ZStack(alignment: .leading) {
                    timelineLabels
                        .mask(alignment: .leading) {
                            Rectangle()
                                .frame(width: min(max(runnerX - 3, 0), geometry.size.width))
                        }

                    if Self.shouldRenderRunner(
                        shouldAnimateEntrance: shouldAnimateEntrance,
                        reduceMotion: reduceMotion
                    ) {
                        HumanRunnerView(phase: runPhase)
                            .frame(width: Self.runnerWidth, height: Self.runnerHeight)
                            .offset(x: runnerX - Self.runnerWidth / 2)
                            .accessibilityHidden(true)
                    }
                }
                .frame(
                    width: geometry.size.width,
                    height: geometry.size.height,
                    alignment: .leading
                )
            }
        }
        .frame(height: Self.stageHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("职业时间线，2014，2019，2023，当前 2026，仍在继续向前")
        .task(id: shouldAnimateEntrance) {
            if reduceMotion || !shouldAnimateEntrance {
                startDate = nil
                return
            }

            startDate = Date()
            do {
                try await Task.sleep(for: .seconds(Self.journeyDuration))
                guard !Task.isCancelled else { return }
                onEntranceCompleted()
            } catch {
                return
            }
        }
    }

    private var timelineLabels: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            ForEach(Self.years, id: \.self) { year in
                let index = Self.years.firstIndex(of: year) ?? 0

                Text(year)
                    .font(.system(size: Self.fontSize, weight: .medium, design: .monospaced))
                    .foregroundStyle(Color.psInk.opacity(Self.opacity(for: index)))
                    .overlay(alignment: .bottom) {
                        if year == Self.years.last {
                            Capsule()
                                .fill(Color.psInk)
                                .frame(height: 1.5)
                                .offset(y: 3)
                        }
                    }

                if year != Self.years.last {
                    Spacer(minLength: 4)
                    Text("→")
                        .font(.system(size: 9.5, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color.psInk.opacity(Self.opacity(for: index)))
                    Spacer(minLength: 4)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.trailing, ProfileHeaderContent.expandedTimelineTrailingInset)
    }

    private func journeyProgress(elapsed: TimeInterval) -> CGFloat {
        if reduceMotion || !shouldAnimateEntrance { return 1 }
        guard startDate != nil else { return 0 }
        return min(max(CGFloat(elapsed / Self.journeyDuration), 0), 1)
    }

    nonisolated static func opacity(for index: Int) -> Double {
        opacities[min(max(index, 0), opacities.count - 1)]
    }

    nonisolated static func runnerCenterX(progress: CGFloat, width: CGFloat) -> CGFloat {
        let clampedProgress = min(max(progress, 0), 1)
        return -runnerWidth / 2 + clampedProgress * (width + runnerWidth)
    }

    nonisolated static func shouldRenderRunner(
        shouldAnimateEntrance: Bool,
        reduceMotion: Bool
    ) -> Bool {
        shouldAnimateEntrance && !reduceMotion
    }
}

private struct HumanRunnerView: View {
    var phase: Double

    nonisolated static let cycleDuration = 0.72

    var body: some View {
        Canvas { context, size in
            let pose = HumanRunPose.sample(at: phase)
            let scale = min(
                size.width / HumanRunPose.canvasSize.width,
                size.height / HumanRunPose.canvasSize.height
            )
            let origin = CGPoint(
                x: (size.width - HumanRunPose.canvasSize.width * scale) / 2,
                y: (size.height - HumanRunPose.canvasSize.height * scale) / 2
            )
            let ink = Color.psInk

            drawLeg(
                hip: pose.hip,
                knee: pose.legBKnee,
                ankle: pose.legBAnkle,
                toe: pose.legBToe,
                color: ink.opacity(0.62),
                in: &context,
                origin: origin,
                scale: scale
            )
            drawArm(
                shoulder: pose.shoulder,
                elbow: pose.armBElbow,
                wrist: pose.armBWrist,
                color: ink.opacity(0.58),
                in: &context,
                origin: origin,
                scale: scale
            )

            drawTorso(pose: pose, color: ink, in: &context, origin: origin, scale: scale)

            drawLeg(
                hip: pose.hip,
                knee: pose.legAKnee,
                ankle: pose.legAAnkle,
                toe: pose.legAToe,
                color: ink,
                in: &context,
                origin: origin,
                scale: scale
            )
            drawArm(
                shoulder: pose.shoulder,
                elbow: pose.armAElbow,
                wrist: pose.armAWrist,
                color: ink,
                in: &context,
                origin: origin,
                scale: scale
            )

            drawHead(pose: pose, color: ink, in: &context, origin: origin, scale: scale)
        }
    }

    private func drawTorso(
        pose: HumanRunPose,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        let shoulder = transform(pose.shoulder, origin: origin, scale: scale)
        let hip = transform(pose.hip, origin: origin, scale: scale)
        let axis = CGVector(dx: hip.x - shoulder.x, dy: hip.y - shoulder.y)
        let length = max(hypot(axis.dx, axis.dy), 0.001)
        let normal = CGVector(dx: -axis.dy / length, dy: axis.dx / length)
        let shoulderHalfWidth = 2.15 * scale
        let hipHalfWidth = 1.35 * scale

        var torso = Path()
        torso.move(to: offset(shoulder, by: normal, amount: shoulderHalfWidth))
        torso.addQuadCurve(
            to: offset(hip, by: normal, amount: hipHalfWidth),
            control: offset(midpoint(shoulder, hip), by: normal, amount: 1.75 * scale)
        )
        torso.addQuadCurve(
            to: offset(hip, by: normal, amount: -hipHalfWidth),
            control: CGPoint(x: hip.x + 0.25 * scale, y: hip.y + 0.9 * scale)
        )
        torso.addQuadCurve(
            to: offset(shoulder, by: normal, amount: -shoulderHalfWidth),
            control: offset(midpoint(shoulder, hip), by: normal, amount: -1.55 * scale)
        )
        torso.closeSubpath()
        context.fill(torso, with: .color(color))

        drawSegment(
            from: pose.neck,
            to: pose.shoulder,
            width: 1.9,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawJoint(at: pose.hip, radius: 1.5, color: color, in: &context, origin: origin, scale: scale)
    }

    private func drawHead(
        pose: HumanRunPose,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        let center = transform(pose.head, origin: origin, scale: scale)
        let radius = 1.95 * scale
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - radius,
                y: center.y - radius * 1.08,
                width: radius * 2,
                height: radius * 2.16
            )),
            with: .color(color)
        )

        var face = Path()
        face.move(to: CGPoint(x: center.x + radius * 0.72, y: center.y - radius * 0.18))
        face.addLine(to: CGPoint(x: center.x + radius * 1.18, y: center.y + radius * 0.08))
        face.addLine(to: CGPoint(x: center.x + radius * 0.72, y: center.y + radius * 0.28))
        face.closeSubpath()
        context.fill(face, with: .color(color))
    }

    private func drawArm(
        shoulder: CGPoint,
        elbow: CGPoint,
        wrist: CGPoint,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        drawSegment(
            from: shoulder,
            to: elbow,
            width: 1.75,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawSegment(
            from: elbow,
            to: wrist,
            width: 1.35,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawJoint(at: elbow, radius: 0.8, color: color, in: &context, origin: origin, scale: scale)
        drawJoint(at: wrist, radius: 0.72, color: color, in: &context, origin: origin, scale: scale)
    }

    private func drawLeg(
        hip: CGPoint,
        knee: CGPoint,
        ankle: CGPoint,
        toe: CGPoint,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        drawSegment(
            from: hip,
            to: knee,
            width: 2.35,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawSegment(
            from: knee,
            to: ankle,
            width: 1.75,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawSegment(
            from: ankle,
            to: toe,
            width: 1.55,
            color: color,
            in: &context,
            origin: origin,
            scale: scale
        )
        drawJoint(at: knee, radius: 1.0, color: color, in: &context, origin: origin, scale: scale)
    }

    private func drawSegment(
        from start: CGPoint,
        to end: CGPoint,
        width: CGFloat,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        var path = Path()
        path.move(to: transform(start, origin: origin, scale: scale))
        path.addLine(to: transform(end, origin: origin, scale: scale))
        context.stroke(
            path,
            with: .color(color),
            style: StrokeStyle(lineWidth: width * scale, lineCap: .round, lineJoin: .round)
        )
    }

    private func drawJoint(
        at point: CGPoint,
        radius: CGFloat,
        color: Color,
        in context: inout GraphicsContext,
        origin: CGPoint,
        scale: CGFloat
    ) {
        let center = transform(point, origin: origin, scale: scale)
        let scaledRadius = radius * scale
        context.fill(
            Path(ellipseIn: CGRect(
                x: center.x - scaledRadius,
                y: center.y - scaledRadius,
                width: scaledRadius * 2,
                height: scaledRadius * 2
            )),
            with: .color(color)
        )
    }

    private func midpoint(_ first: CGPoint, _ second: CGPoint) -> CGPoint {
        CGPoint(x: (first.x + second.x) / 2, y: (first.y + second.y) / 2)
    }

    private func offset(_ point: CGPoint, by vector: CGVector, amount: CGFloat) -> CGPoint {
        CGPoint(x: point.x + vector.dx * amount, y: point.y + vector.dy * amount)
    }

    private func transform(_ point: CGPoint, origin: CGPoint, scale: CGFloat) -> CGPoint {
        CGPoint(x: origin.x + point.x * scale, y: origin.y + point.y * scale)
    }
}

private struct HumanRunPose: Sendable {
    var head: CGPoint
    var neck: CGPoint
    var shoulder: CGPoint
    var hip: CGPoint
    var armAElbow: CGPoint
    var armAWrist: CGPoint
    var armBElbow: CGPoint
    var armBWrist: CGPoint
    var legAKnee: CGPoint
    var legAAnkle: CGPoint
    var legAToe: CGPoint
    var legBKnee: CGPoint
    var legBAnkle: CGPoint
    var legBToe: CGPoint

    nonisolated static let canvasSize = CGSize(width: 24, height: 26)

    private nonisolated static let keyframes: [HumanRunPose] = {
        let firstHalf = [
            HumanRunPose(
                head: CGPoint(x: 14.6, y: 3.6),
                neck: CGPoint(x: 13.4, y: 6.0),
                shoulder: CGPoint(x: 12.0, y: 7.5),
                hip: CGPoint(x: 10.1, y: 13.2),
                armAElbow: CGPoint(x: 8.5, y: 9.3),
                armAWrist: CGPoint(x: 6.5, y: 12.6),
                armBElbow: CGPoint(x: 15.3, y: 8.6),
                armBWrist: CGPoint(x: 17.8, y: 11.0),
                legAKnee: CGPoint(x: 15.4, y: 16.2),
                legAAnkle: CGPoint(x: 20.1, y: 21.6),
                legAToe: CGPoint(x: 22.7, y: 21.9),
                legBKnee: CGPoint(x: 6.4, y: 16.2),
                legBAnkle: CGPoint(x: 3.1, y: 13.1),
                legBToe: CGPoint(x: 1.0, y: 13.3)
            ),
            HumanRunPose(
                head: CGPoint(x: 14.5, y: 4.4),
                neck: CGPoint(x: 13.3, y: 6.8),
                shoulder: CGPoint(x: 11.9, y: 8.2),
                hip: CGPoint(x: 10.2, y: 14.1),
                armAElbow: CGPoint(x: 8.8, y: 10.3),
                armAWrist: CGPoint(x: 7.2, y: 13.5),
                armBElbow: CGPoint(x: 15.4, y: 9.4),
                armBWrist: CGPoint(x: 18.0, y: 11.7),
                legAKnee: CGPoint(x: 14.5, y: 17.6),
                legAAnkle: CGPoint(x: 19.0, y: 22.1),
                legAToe: CGPoint(x: 22.0, y: 22.2),
                legBKnee: CGPoint(x: 6.2, y: 16.9),
                legBAnkle: CGPoint(x: 2.8, y: 14.4),
                legBToe: CGPoint(x: 0.7, y: 14.5)
            ),
            HumanRunPose(
                head: CGPoint(x: 14.6, y: 3.4),
                neck: CGPoint(x: 13.4, y: 5.9),
                shoulder: CGPoint(x: 12.1, y: 7.4),
                hip: CGPoint(x: 10.3, y: 13.0),
                armAElbow: CGPoint(x: 12.8, y: 10.0),
                armAWrist: CGPoint(x: 15.1, y: 11.4),
                armBElbow: CGPoint(x: 9.1, y: 9.7),
                armBWrist: CGPoint(x: 7.0, y: 12.4),
                legAKnee: CGPoint(x: 8.0, y: 17.0),
                legAAnkle: CGPoint(x: 4.2, y: 20.9),
                legAToe: CGPoint(x: 1.8, y: 21.0),
                legBKnee: CGPoint(x: 14.3, y: 14.9),
                legBAnkle: CGPoint(x: 12.0, y: 18.3),
                legBToe: CGPoint(x: 14.4, y: 18.5)
            ),
            HumanRunPose(
                head: CGPoint(x: 14.7, y: 2.8),
                neck: CGPoint(x: 13.5, y: 5.3),
                shoulder: CGPoint(x: 12.2, y: 6.9),
                hip: CGPoint(x: 10.4, y: 12.4),
                armAElbow: CGPoint(x: 15.2, y: 7.9),
                armAWrist: CGPoint(x: 17.3, y: 10.5),
                armBElbow: CGPoint(x: 8.3, y: 8.5),
                armBWrist: CGPoint(x: 6.3, y: 11.5),
                legAKnee: CGPoint(x: 6.3, y: 15.2),
                legAAnkle: CGPoint(x: 2.2, y: 17.9),
                legAToe: CGPoint(x: 0.4, y: 18.0),
                legBKnee: CGPoint(x: 15.7, y: 14.0),
                legBAnkle: CGPoint(x: 18.2, y: 17.3),
                legBToe: CGPoint(x: 20.9, y: 17.6)
            ),
        ]
        return firstHalf + firstHalf.map(\.swappedSides)
    }()

    private nonisolated var swappedSides: HumanRunPose {
        HumanRunPose(
            head: head,
            neck: neck,
            shoulder: shoulder,
            hip: hip,
            armAElbow: armBElbow,
            armAWrist: armBWrist,
            armBElbow: armAElbow,
            armBWrist: armAWrist,
            legAKnee: legBKnee,
            legAAnkle: legBAnkle,
            legAToe: legBToe,
            legBKnee: legAKnee,
            legBAnkle: legAAnkle,
            legBToe: legAToe
        )
    }

    nonisolated static func sample(at phase: Double) -> HumanRunPose {
        let count = keyframes.count
        let wrapped = phase - floor(phase)
        let position = wrapped * Double(count)
        let index = Int(floor(position)) % count
        let amount = CGFloat(position - floor(position))

        return interpolate(
            keyframes[(index - 1 + count) % count],
            keyframes[index],
            keyframes[(index + 1) % count],
            keyframes[(index + 2) % count],
            amount: amount
        )
    }

    private nonisolated static func interpolate(
        _ previous: HumanRunPose,
        _ start: HumanRunPose,
        _ end: HumanRunPose,
        _ next: HumanRunPose,
        amount: CGFloat
    ) -> HumanRunPose {
        HumanRunPose(
            head: catmullRom(previous.head, start.head, end.head, next.head, amount: amount),
            neck: catmullRom(previous.neck, start.neck, end.neck, next.neck, amount: amount),
            shoulder: catmullRom(previous.shoulder, start.shoulder, end.shoulder, next.shoulder, amount: amount),
            hip: catmullRom(previous.hip, start.hip, end.hip, next.hip, amount: amount),
            armAElbow: catmullRom(previous.armAElbow, start.armAElbow, end.armAElbow, next.armAElbow, amount: amount),
            armAWrist: catmullRom(previous.armAWrist, start.armAWrist, end.armAWrist, next.armAWrist, amount: amount),
            armBElbow: catmullRom(previous.armBElbow, start.armBElbow, end.armBElbow, next.armBElbow, amount: amount),
            armBWrist: catmullRom(previous.armBWrist, start.armBWrist, end.armBWrist, next.armBWrist, amount: amount),
            legAKnee: catmullRom(previous.legAKnee, start.legAKnee, end.legAKnee, next.legAKnee, amount: amount),
            legAAnkle: catmullRom(previous.legAAnkle, start.legAAnkle, end.legAAnkle, next.legAAnkle, amount: amount),
            legAToe: catmullRom(previous.legAToe, start.legAToe, end.legAToe, next.legAToe, amount: amount),
            legBKnee: catmullRom(previous.legBKnee, start.legBKnee, end.legBKnee, next.legBKnee, amount: amount),
            legBAnkle: catmullRom(previous.legBAnkle, start.legBAnkle, end.legBAnkle, next.legBAnkle, amount: amount),
            legBToe: catmullRom(previous.legBToe, start.legBToe, end.legBToe, next.legBToe, amount: amount)
        )
    }

    private nonisolated static func catmullRom(
        _ previous: CGPoint,
        _ start: CGPoint,
        _ end: CGPoint,
        _ next: CGPoint,
        amount: CGFloat
    ) -> CGPoint {
        CGPoint(
            x: catmullRom(previous.x, start.x, end.x, next.x, amount: amount),
            y: catmullRom(previous.y, start.y, end.y, next.y, amount: amount)
        )
    }

    private nonisolated static func catmullRom(
        _ previous: CGFloat,
        _ start: CGFloat,
        _ end: CGFloat,
        _ next: CGFloat,
        amount: CGFloat
    ) -> CGFloat {
        let squared = amount * amount
        let cubed = squared * amount
        return 0.5 * (
            (2 * start)
                + (-previous + end) * amount
                + (2 * previous - 5 * start + 4 * end - next) * squared
                + (-previous + 3 * start - 3 * end + next) * cubed
        )
    }
}
