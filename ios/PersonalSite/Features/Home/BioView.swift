import SwiftUI

/// Bio 打字机：完整移植 components/profile-introduction.tsx 的首访序列与问候语循环。
/// 首访：英文标题+三段（5.5ms/字）→ 停 720ms → 倒序擦除（2ms/字）→ 光标停 1520ms
/// → 中文标题+三段（6.5ms/字）→ 完成后 14 个问候语无限循环（72ms/字，每个驻留 2600ms）。
/// 标点停顿 70ms、段间 280ms；reduced-motion 直接全量中文、不循环。
struct BioView: View {
    /// Loader 滑出完成（Web 端等 .opening-loader 从 DOM 移除后开播）。
    var startSignal: Bool
    /// 是否播放首访序列（App 级会话内只播一次）；false 直接全量中文。
    var shouldPlaySequence: Bool
    var onSequenceCompleted: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var phase: Phase = .complete
    @State private var visibleCounts: [Int]
    @State private var activeIndex: Int?
    @State private var titleVisibleCount: Int
    @State private var titleIsTyping = false
    @State private var greetingIndex = 0
    @State private var hasStarted = false
    @State private var caretVisible = true

    private static let englishCharacterDelay = 5.5
    private static let chineseCharacterDelay = 6.5
    private static let deleteCharacterDelay = 2.0
    private static let pauseDelay = 280.0
    private static let punctuationDelay = 70.0
    private static let languageTransitionDelay = 720.0
    private static let cursorBlinkDelay = 1520.0
    private static let greetingCharacterDelay = 72.0
    private static let greetingHoldDelay = 2600.0

    private static let englishTitle = "Hello,"
    private static let chineseTitle = "你好，"
    private static let greetings = [
        chineseTitle, englishTitle, "Hola,", "こんにちは、", "안녕하세요,",
        "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,",
        "Привет,", "مرحبًا،", "สวัสดีครับ,",
    ]

    static let profileCopy = [
        "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
        "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
        "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
    ]

    static let profileCopyEnglish = [
        "With more than a decade in project development across Java, Python, TypeScript, and frontend work, I have built engineering systems meant to be owned for the long term—from business platforms and cloud services to enterprise AI.",
        "I care about how AI enters real work, how the web becomes a new creative interface, and how systems remain useful over time.",
        "This is where I document what I am building and the engineering problems worth continuing to unpack.",
    ]

    private enum Phase {
        case english, erasing, chinese, complete
    }

    init(startSignal: Bool, shouldPlaySequence: Bool, onSequenceCompleted: @escaping () -> Void) {
        self.startSignal = startSignal
        self.shouldPlaySequence = shouldPlaySequence
        self.onSequenceCompleted = onSequenceCompleted
        _visibleCounts = State(initialValue: Self.profileCopy.map(\.count))
        _titleVisibleCount = State(initialValue: Self.chineseTitle.count)
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // 预留高度：不可见全文撑出 EN/CN 较大者，防止打字过程布局跳动；
            // 首访序列完成后与 Web 一致释放预留。
            if shouldPlaySequence && phase != .complete {
                fullText(title: Self.englishTitle, paragraphs: Self.profileCopyEnglish).hidden()
                fullText(title: Self.chineseTitle, paragraphs: Self.profileCopy).hidden()
            }
            liveText
        }
        .onAppear { startIfNeeded() }
        .onChange(of: startSignal) { startIfNeeded() }
        .onReceive(Timer.publish(every: 0.38, on: .main, in: .common).autoconnect()) { _ in
            caretVisible.toggle()
        }
    }

    // MARK: - 视图

    private var displayedParagraphs: [String] {
        phase == .english || phase == .erasing ? Self.profileCopyEnglish : Self.profileCopy
    }

    private var title: String {
        switch phase {
        case .english, .erasing: return Self.englishTitle
        case .complete: return Self.greetings[greetingIndex]
        case .chinese: return Self.chineseTitle
        }
    }

    private var liveText: some View {
        VStack(alignment: .leading, spacing: 0) {
            typingText(String(title.prefix(titleVisibleCount)), isTyping: titleIsTyping, isTitle: true)
            ForEach(Array(displayedParagraphs.enumerated()), id: \.offset) { index, paragraph in
                typingText(
                    String(paragraph.prefix(visibleCounts[index])),
                    isTyping: activeIndex == index,
                    isTitle: false
                )
                .padding(.top, 18.4)
            }
        }
    }

    /// 打字中的段落带块状光标（0.42em 宽方块，760ms step 闪烁），用内联 ▍ 近似，
    /// 随文本自然换行。
    private func typingText(_ text: String, isTyping: Bool, isTitle: Bool) -> some View {
        let fontSize = isTitle ? 16.0 : 12.5
        var content = Text(text)
        if isTyping && caretVisible {
            content = content + Text("▍")
        }
        return content
            .font(.system(size: fontSize, weight: isTitle ? .semibold : .regular))
            .tracking(-0.035 * fontSize)
            .lineSpacing(isTitle ? 0 : fontSize * 0.32)
            .foregroundStyle(isTitle ? Color.psInk : Color.psQuiet)
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func fullText(title: String, paragraphs: [String]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .tracking(-0.035 * 16)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(paragraphs, id: \.self) { paragraph in
                Text(paragraph)
                    .font(.system(size: 12.5))
                    .tracking(-0.035 * 12.5)
                    .lineSpacing(12.5 * 0.32)
                    .padding(.top, 18.4)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - 播放驱动

    private func startIfNeeded() {
        guard !hasStarted, startSignal else { return }
        hasStarted = true
        if reduceMotion || !shouldPlaySequence {
            showAll()
            return
        }
        Task { await playSequence() }
    }

    @MainActor
    private func showAll() {
        visibleCounts = Self.profileCopy.map(\.count)
        activeIndex = nil
        phase = .complete
        titleVisibleCount = Self.chineseTitle.count
        titleIsTyping = false
    }

    @MainActor
    private func playSequence() async {
        phase = .english
        visibleCounts = Self.profileCopyEnglish.map { _ in 0 }
        titleVisibleCount = 0
        await typeTitle(Self.englishTitle, characterDelay: Self.englishCharacterDelay)
        await typeParagraphs(Self.profileCopyEnglish, characterDelay: Self.englishCharacterDelay)
        guard await wait(Self.languageTransitionDelay) else { return }

        phase = .erasing
        for index in stride(from: Self.profileCopyEnglish.count - 1, through: 0, by: -1) {
            activeIndex = index
            await erase(count: Self.profileCopyEnglish[index].count) { visibleCounts[index] = $0 }
            guard await wait(Self.pauseDelay) else { return }
        }
        activeIndex = nil
        titleIsTyping = true
        await erase(count: Self.englishTitle.count) { titleVisibleCount = $0 }
        titleIsTyping = false
        guard await wait(Self.cursorBlinkDelay) else { return }

        phase = .chinese
        visibleCounts = Self.profileCopy.map { _ in 0 }
        titleVisibleCount = 0
        await typeTitle(Self.chineseTitle, characterDelay: Self.chineseCharacterDelay)
        await typeParagraphs(Self.profileCopy, characterDelay: Self.chineseCharacterDelay)
        activeIndex = nil
        phase = .complete
        onSequenceCompleted()

        await cycleGreetings()
    }

    private func cycleGreetings() async {
        var next = 1
        while !Task.isCancelled {
            guard await wait(Self.greetingHoldDelay) else { return }
            greetingIndex = next
            titleVisibleCount = 0
            titleIsTyping = true
            await type(text: Self.greetings[next], characterDelay: Self.greetingCharacterDelay,
                       isTitlePunctuation: true) { titleVisibleCount = $0 }
            titleIsTyping = false
            next = (next + 1) % Self.greetings.count
        }
    }

    private func typeTitle(_ title: String, characterDelay: Double) async {
        titleIsTyping = true
        await type(text: title, characterDelay: characterDelay, isTitlePunctuation: true) {
            titleVisibleCount = $0
        }
        titleIsTyping = false
    }

    private func typeParagraphs(_ paragraphs: [String], characterDelay: Double) async {
        for (index, paragraph) in paragraphs.enumerated() {
            activeIndex = index
            await type(text: paragraph, characterDelay: characterDelay, isTitlePunctuation: false) {
                visibleCounts[index] = $0
            }
            guard await wait(Self.pauseDelay) else { return }
        }
    }

    /// 对齐 Web 的 createCharacterTimeline：首字符立即出现，字符 i+1 在字符 i 的
    /// 延时结束后出现，结尾再补最后一个字符自身的延时。
    private func type(text: String, characterDelay: Double, isTitlePunctuation: Bool,
                      onCount: @MainActor (Int) -> Void) async {
        let characters = Array(text)
        guard !characters.isEmpty else { return }
        onCount(1)
        for index in characters.indices {
            let delay = isPunctuation(characters[index], title: isTitlePunctuation)
                ? Self.punctuationDelay : characterDelay
            guard await wait(delay) else { return }
            if index + 1 < characters.count { onCount(index + 2) }
        }
    }

    private func erase(count: Int, onCount: @MainActor (Int) -> Void) async {
        guard count > 0 else { return }
        for step in 0 ..< count {
            onCount(count - 1 - step)
            guard await wait(Self.deleteCharacterDelay) else { return }
        }
    }

    private func wait(_ milliseconds: Double) async -> Bool {
        try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        return !Task.isCancelled
    }

    private func isPunctuation(_ character: Character, title: Bool) -> Bool {
        let titlePunctuation: Set<Character> = ["，", "、", ",", ".", "!", "?"]
        let paragraphPunctuation: Set<Character> = ["，", "。", "；", "、", ",", ".", "!", "?"]
        return (title ? titlePunctuation : paragraphPunctuation).contains(character)
    }
}
