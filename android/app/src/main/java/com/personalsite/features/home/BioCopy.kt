package com.personalsite.features.home

/** Bio 打字机的文案与终态快照（对齐 iOS BioView 的 static 文案与 BioAnimationSnapshot）。 */
object BioCopy {
    const val englishTitle = "Hello,"
    const val chineseTitle = "你好，"
    val greetings = listOf(
        chineseTitle, englishTitle, "Hola,", "こんにちは、", "안녕하세요,",
        "Bonjour,", "नमस्ते,", "Ciao,", "Olá,", "Hallo,", "Merhaba,",
        "Привет,", "مرحبًا،", "สวัสดีครับ,",
    )

    val profileCopy = listOf(
        "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
        "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
        "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
    )

    val profileCopyEnglish = listOf(
        "With more than a decade in project development across Java, Python, TypeScript, and frontend work, I have built engineering systems meant to be owned for the long term—from business platforms and cloud services to enterprise AI.",
        "I care about how AI enters real work, how the web becomes a new creative interface, and how systems remain useful over time.",
        "This is where I document what I am building and the engineering problems worth continuing to unpack.",
    )

    // 节拍（毫秒），对齐 iOS BioView。
    const val TITLE_CHARACTER_DELAY_MS = 72L
    const val PUNCTUATION_DELAY_MS = 70L
    const val PARAGRAPH_STAGGER_MS = 60L
    const val LANGUAGE_TRANSITION_DELAY_MS = 720L
    const val GREETING_HOLD_DELAY_MS = 2600L

    fun isPunctuation(char: Char): Boolean = char in listOf('，', '、', ',', '.', '!', '?')
}

data class BioAnimationSnapshot(
    val visibleCounts: List<Int>,
    val titleVisibleCount: Int,
) {
    companion object {
        val final: BioAnimationSnapshot
            get() = BioAnimationSnapshot(
                visibleCounts = BioCopy.profileCopy.map { it.length },
                titleVisibleCount = BioCopy.chineseTitle.length,
            )
    }
}
