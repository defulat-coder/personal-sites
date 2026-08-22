import SwiftUI

struct BioAnimationSnapshot: Equatable {
    var visibleCounts: [Int]
    var titleVisibleCount: Int

    static var final: BioAnimationSnapshot {
        BioAnimationSnapshot(
            visibleCounts: BioView.profileCopy.map(\.count),
            titleVisibleCount: BioView.chineseTitle.count
        )
    }
}

/// A short, lifecycle-bound title delight. Body copy appears as complete paragraphs
/// so navigation and cancellation can never leave the biography unreadable.
struct BioView: View {
    var startSignal: Bool
    var shouldPlaySequence: Bool
    var onSequenceCompleted: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var phase: Phase = .complete
    @State private var snapshot = BioAnimationSnapshot.final
    @State private var titleIsTyping = false
    @State private var greetingIndex = 0

    private static let titleCharacterDelay = 72.0
    private static let punctuationDelay = 70.0
    private static let paragraphStagger = 60.0
    private static let languageTransitionDelay = 720.0
    private static let greetingHoldDelay = 2600.0

    nonisolated static let englishTitle = "Hello,"
    nonisolated static let chineseTitle = "你好，"
    private static let greetings = [
        chineseTitle, englishTitle, "Hola,", "こんにちは、", "안녕하세요,",
        "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,",
        "Привет,", "مرحبًا،", "สวัสดีครับ,",
    ]

    nonisolated static let profileCopy = [
        "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
        "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
        "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
    ]

    nonisolated static let profileCopyEnglish = [
        "With more than a decade in project development across Java, Python, TypeScript, and frontend work, I have built engineering systems meant to be owned for the long term—from business platforms and cloud services to enterprise AI.",
        "I care about how AI enters real work, how the web becomes a new creative interface, and how systems remain useful over time.",
        "This is where I document what I am building and the engineering problems worth continuing to unpack.",
    ]

    private enum Phase {
        case english
        case chinese
        case complete
    }

    private struct TaskIdentity: Equatable {
        var startSignal: Bool
        var shouldPlaySequence: Bool
        var reduceMotion: Bool
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            if shouldPlaySequence && phase != .complete {
                fullText.hidden()
            }
            liveText
        }
        .task(id: TaskIdentity(
            startSignal: startSignal,
            shouldPlaySequence: shouldPlaySequence,
            reduceMotion: reduceMotion
        )) {
            await driveSequence()
        }
    }

    private var displayedParagraphs: [String] {
        phase == .english ? Self.profileCopyEnglish : Self.profileCopy
    }

    private var title: String {
        switch phase {
        case .english: Self.englishTitle
        case .chinese: Self.chineseTitle
        case .complete: Self.greetings[greetingIndex]
        }
    }

    private var liveText: some View {
        VStack(alignment: .leading, spacing: 0) {
            typingText(String(title.prefix(snapshot.titleVisibleCount)), isTyping: titleIsTyping, isTitle: true)
            ForEach(Array(displayedParagraphs.enumerated()), id: \.offset) { index, paragraph in
                typingText(String(paragraph.prefix(snapshot.visibleCounts[index])), isTyping: false, isTitle: false)
                    .padding(.top, 18.4)
                    .transition(.opacity)
            }
        }
        .animation(PSMotion.stateChange, value: snapshot.visibleCounts)
    }

    @ViewBuilder
    private func typingText(_ text: String, isTyping: Bool, isTitle: Bool) -> some View {
        let fontSize = isTitle ? 16.0 : 12.5
        if isTyping {
            TimelineView(.periodic(from: .now, by: 0.38)) { context in
                styledText(
                    text + (Int(context.date.timeIntervalSinceReferenceDate / 0.38).isMultiple(of: 2) ? "▍" : ""),
                    fontSize: fontSize,
                    isTitle: isTitle
                )
            }
        } else {
            styledText(text, fontSize: fontSize, isTitle: isTitle)
        }
    }

    private func styledText(_ text: String, fontSize: Double, isTitle: Bool) -> some View {
        Text(text)
            .font(.system(size: fontSize, weight: isTitle ? .semibold : .regular))
            .tracking(-0.035 * fontSize)
            .lineSpacing(isTitle ? 0 : fontSize * 0.32)
            .foregroundStyle(isTitle ? Color.psInk : Color.psQuiet)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var fullText: some View {
        VStack(alignment: .leading, spacing: 0) {
            styledText(Self.chineseTitle, fontSize: 16, isTitle: true)
            ForEach(Self.profileCopy, id: \.self) { paragraph in
                styledText(paragraph, fontSize: 12.5, isTitle: false)
                    .padding(.top, 18.4)
            }
        }
    }

    @MainActor
    private func driveSequence() async {
        guard startSignal else {
            showFinalState()
            return
        }
        guard shouldPlaySequence, !reduceMotion else {
            showFinalState()
            return
        }

        defer {
            if Task.isCancelled { showFinalState() }
        }

        phase = .english
        snapshot = BioAnimationSnapshot(visibleCounts: Self.profileCopyEnglish.map { _ in 0 }, titleVisibleCount: 0)
        await typeTitle(Self.englishTitle)
        guard await wait(Self.languageTransitionDelay) else { return }

        phase = .chinese
        snapshot = BioAnimationSnapshot(visibleCounts: Self.profileCopy.map { _ in 0 }, titleVisibleCount: Self.chineseTitle.count)
        titleIsTyping = false
        for index in Self.profileCopy.indices {
            snapshot.visibleCounts[index] = Self.profileCopy[index].count
            guard await wait(Self.paragraphStagger) else { return }
        }

        phase = .complete
        onSequenceCompleted()
        await cycleGreetings()
    }

    @MainActor
    private func showFinalState() {
        snapshot = .final
        phase = .complete
        titleIsTyping = false
        greetingIndex = 0
    }

    private func typeTitle(_ value: String) async {
        titleIsTyping = true
        for index in value.indices {
            snapshot.titleVisibleCount = value.distance(from: value.startIndex, to: index) + 1
            let delay = value[index].isPunctuation ? Self.punctuationDelay : Self.titleCharacterDelay
            guard await wait(delay) else { return }
        }
        titleIsTyping = false
    }

    private func cycleGreetings() async {
        var next = 1
        while !Task.isCancelled {
            guard await wait(Self.greetingHoldDelay) else { return }
            greetingIndex = next
            snapshot.titleVisibleCount = 0
            await typeTitle(Self.greetings[next])
            next = (next + 1) % Self.greetings.count
        }
    }

    private func wait(_ milliseconds: Double) async -> Bool {
        do {
            try await Task.sleep(for: .milliseconds(milliseconds))
            return !Task.isCancelled
        } catch {
            return false
        }
    }
}

private extension Character {
    var isPunctuation: Bool {
        ["，", "、", ",", ".", "!", "?"].contains(self)
    }
}
