import SwiftUI

struct AboutPrintView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    var onDismiss: () -> Void

    @State private var paperProgress: CGFloat = 0
    @State private var receiptHeight: CGFloat = 1
    @State private var isPrinting = true

    private static let feedStops: [CGFloat] = [0.09, 0.19, 0.30, 0.42, 0.55, 0.68, 0.80, 0.90, 0.97, 1]
    private static let moveDuration = 0.18
    private static let pauseDuration = 0.066

    var body: some View {
        ZStack {
            Color.black
                .opacity(colorScheme == .dark ? 0.56 : 0.36)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onDismiss)
                .accessibilityHidden(true)

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    printerMachine
                        .zIndex(2)
                    receiptOutput
                        .zIndex(1)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 24)
            }
            .frame(maxWidth: 360, maxHeight: .infinity)
            .scrollBounceBehavior(.basedOnSize)
        }
        .task { await printReceipt() }
        .sensoryFeedback(.success, trigger: isPrinting) { old, new in
            old && !new && !reduceMotion
        }
    }

    private var printerMachine: some View {
        VStack(spacing: 12) {
            HStack(spacing: 8) {
                if isPrinting {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Color(red: 232 / 255, green: 232 / 255, blue: 234 / 255))
                        .transition(.opacity)
                } else {
                    Image(systemName: "checkmark.circle")
                        .transition(.opacity)
                }
                Text(isPrinting ? "正在打印个人经历…" : "打印完成 · 请取走小票")
                Spacer(minLength: 0)
                Button {
                    onDismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .semibold))
                        .frame(width: 24, height: 24)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PSPressButtonStyle())
                .accessibilityLabel("关闭")
            }
            .font(.system(size: 11, weight: .medium, design: .monospaced))
            .foregroundStyle(Color(red: 232 / 255, green: 232 / 255, blue: 234 / 255))
            .padding(.horizontal, 12)
            .frame(height: 38)
            .background(Color(red: 23 / 255, green: 23 / 255, blue: 26 / 255), in: .rect(cornerRadius: 11))
            .accessibilityElement(children: .contain)

            Capsule()
                .fill(Color(red: 18 / 255, green: 18 / 255, blue: 20 / 255))
                .frame(height: 8)
                .padding(.horizontal, 8)
                .shadow(color: .black.opacity(0.42), radius: 2, y: 1)
        }
        .padding(.horizontal, 14)
        .padding(.top, 14)
        .padding(.bottom, 12)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 246 / 255, green: 246 / 255, blue: 247 / 255),
                    Color(red: 233 / 255, green: 233 / 255, blue: 235 / 255),
                ],
                startPoint: .top,
                endPoint: .bottom
            ),
            in: .rect(cornerRadius: 22)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color.black.opacity(0.12), lineWidth: 1)
        }
        .shadow(color: .black.opacity(0.18), radius: 24, y: 14)
    }

    private var receiptOutput: some View {
        ZStack(alignment: .top) {
            AboutReceiptView()
                .onGeometryChange(for: CGFloat.self) { proxy in
                    proxy.size.height
                } action: { height in
                    receiptHeight = max(height, 1)
                }
                .offset(y: -(1 - paperProgress) * max(receiptHeight - 4, 0))
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .offset(y: -16)
        .clipped()
        .accessibilityHidden(isPrinting)
    }

    @MainActor
    private func printReceipt() async {
        if reduceMotion {
            paperProgress = 1
            isPrinting = false
            return
        }

        paperProgress = 0
        isPrinting = true
        for (index, stop) in Self.feedStops.enumerated() {
            withAnimation(.linear(duration: Self.moveDuration)) {
                paperProgress = stop
            }
            do {
                try await Task.sleep(for: .seconds(Self.moveDuration))
                if index < Self.feedStops.count - 1 {
                    try await Task.sleep(for: .seconds(Self.pauseDuration))
                }
            } catch {
                return
            }
        }
        isPrinting = false
    }
}

private struct AboutReceiptView: View {
    private struct Item: Identifiable {
        let company: String
        let meta: String
        let years: String
        var id: String { company }
    }

    private let items = [
        Item(company: "PLUS数字科技", meta: "2014—2019 · Java · 服务运维", years: "5 年"),
        Item(company: "红星美凯龙", meta: "2019—2023 · 业务 · 集团架构", years: "4 年"),
        Item(company: "喜马拉雅", meta: "2023—2026 · 企业 AI 应用", years: "3 年"),
        Item(company: "PayerMax", meta: "2026— · OPT · 端到端交付", years: "至今"),
    ]

    var body: some View {
        VStack(spacing: 0) {
            Text("陈远 / CHEN YUAN")
                .font(.system(size: 13, weight: .bold, design: .monospaced))
                .tracking(0.65)
                .foregroundStyle(Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255))
            Text("个人经历 · CAREER RECEIPT")
                .font(.system(size: 10, design: .monospaced))
                .tracking(1)
                .foregroundStyle(Color(red: 101 / 255, green: 101 / 255, blue: 104 / 255))
                .padding(.top, 4)

            ReceiptRule().padding(.vertical, 14)

            VStack(spacing: 12) {
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(item.company)
                            Spacer()
                            Text(item.years)
                        }
                        .font(.system(size: 11.5, weight: .semibold, design: .monospaced))
                        .foregroundStyle(Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255))

                        Text(item.meta)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Color(red: 101 / 255, green: 101 / 255, blue: 104 / 255))
                    }
                }
            }

            ReceiptRule().padding(.vertical, 14)

            HStack(alignment: .firstTextBaseline) {
                Text("合计 TOTAL")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Color(red: 111 / 255, green: 111 / 255, blue: 114 / 255))
                Spacer()
                Text("12 年")
                    .font(.system(size: 16, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color(red: 28 / 255, green: 28 / 255, blue: 30 / 255))
            }

            Text("十二年 · 四段路 · 仍在增长")
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(Color(red: 101 / 255, green: 101 / 255, blue: 104 / 255))
                .padding(.top, 16)

            ReceiptBarcode()
                .frame(height: 30)
                .padding(.top, 12)
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 28)
        .background(Color(red: 248 / 255, green: 248 / 255, blue: 246 / 255), in: ReceiptPaperShape())
        .shadow(color: .black.opacity(0.2), radius: 14, y: 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("陈远个人经历，十二年，四段工作经历，仍在增长")
    }
}

private struct ReceiptRule: View {
    var body: some View {
        Line()
            .stroke(Color.black.opacity(0.24), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
            .frame(height: 1)
    }
}

private struct Line: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}

private struct ReceiptPaperShape: Shape {
    func path(in rect: CGRect) -> Path {
        let toothWidth: CGFloat = 8
        let toothDepth: CGFloat = 5
        var path = Path()
        path.move(to: rect.origin)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - toothDepth))
        var x = rect.maxX
        var down = true
        while x > rect.minX {
            x = max(rect.minX, x - toothWidth / 2)
            path.addLine(to: CGPoint(x: x, y: down ? rect.maxY : rect.maxY - toothDepth))
            down.toggle()
        }
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

private struct ReceiptBarcode: View {
    private let widths: [CGFloat] = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3, 1, 2]

    var body: some View {
        GeometryReader { geometry in
            let total = widths.reduce(0, +) + CGFloat(widths.count - 1)
            let unit = geometry.size.width / total
            HStack(spacing: unit) {
                ForEach(widths.indices, id: \.self) { index in
                    Rectangle()
                        .fill(Color(red: 38 / 255, green: 38 / 255, blue: 42 / 255))
                        .frame(width: widths[index] * unit)
                }
            }
        }
        .accessibilityHidden(true)
    }
}
