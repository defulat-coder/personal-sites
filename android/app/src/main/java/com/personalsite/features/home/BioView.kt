package com.personalsite.features.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.core.PSColors
import kotlinx.coroutines.delay

private enum class BioPhase { ENGLISH, CHINESE, COMPLETE }

/**
 * Bio 打字机（对齐 iOS BioView）：先英文标题逐字、整体切中文、段落整段入场，
 * 之后多语言问候轮播。生命周期绑定，取消/导航不会留下不可读状态。
 */
@Composable
fun BioView(
    startSignal: Boolean,
    shouldPlaySequence: Boolean,
    reduceMotion: Boolean,
    onSequenceCompleted: () -> Unit,
) {
    var phase by remember { mutableStateOf(BioPhase.COMPLETE) }
    var snapshot by remember { mutableStateOf(BioAnimationSnapshot.final) }
    var titleIsTyping by remember { mutableStateOf(false) }
    var greetingIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(startSignal, shouldPlaySequence, reduceMotion) {
        fun showFinal() {
            snapshot = BioAnimationSnapshot.final
            phase = BioPhase.COMPLETE
            titleIsTyping = false
            greetingIndex = 0
        }
        if (!startSignal || !shouldPlaySequence || reduceMotion) {
            showFinal()
            return@LaunchedEffect
        }

        suspend fun typeTitle(value: String) {
            titleIsTyping = true
            value.forEachIndexed { index, char ->
                snapshot = snapshot.copy(titleVisibleCount = index + 1)
                delay(if (BioCopy.isPunctuation(char)) BioCopy.PUNCTUATION_DELAY_MS else BioCopy.TITLE_CHARACTER_DELAY_MS)
            }
            titleIsTyping = false
        }

        phase = BioPhase.ENGLISH
        snapshot = BioAnimationSnapshot(
            visibleCounts = BioCopy.profileCopyEnglish.map { 0 },
            titleVisibleCount = 0,
        )
        typeTitle(BioCopy.englishTitle)
        delay(BioCopy.LANGUAGE_TRANSITION_DELAY_MS)

        phase = BioPhase.CHINESE
        snapshot = BioAnimationSnapshot(
            visibleCounts = BioCopy.profileCopy.map { 0 },
            titleVisibleCount = BioCopy.chineseTitle.length,
        )
        titleIsTyping = false
        BioCopy.profileCopy.indices.forEach { index ->
            snapshot = snapshot.copy(
                visibleCounts = snapshot.visibleCounts.toMutableList().also {
                    it[index] = BioCopy.profileCopy[index].length
                }
            )
            delay(BioCopy.PARAGRAPH_STAGGER_MS)
        }

        phase = BioPhase.COMPLETE
        onSequenceCompleted()

        // 多语言问候轮播
        var next = 1
        while (true) {
            delay(BioCopy.GREETING_HOLD_DELAY_MS)
            greetingIndex = next
            snapshot = snapshot.copy(titleVisibleCount = 0)
            typeTitle(BioCopy.greetings[next])
            next = (next + 1) % BioCopy.greetings.size
        }
    }

    val paragraphs = if (phase == BioPhase.ENGLISH) BioCopy.profileCopyEnglish else BioCopy.profileCopy
    val title = when (phase) {
        BioPhase.ENGLISH -> BioCopy.englishTitle
        BioPhase.CHINESE -> BioCopy.chineseTitle
        BioPhase.COMPLETE -> BioCopy.greetings[greetingIndex]
    }

    Column(Modifier.fillMaxWidth()) {
        TypingText(
            text = title.take(snapshot.titleVisibleCount),
            isTyping = titleIsTyping,
            isTitle = true,
        )
        paragraphs.forEachIndexed { index, paragraph ->
            AnimatedVisibility(
                visible = index < snapshot.visibleCounts.size && snapshot.visibleCounts[index] > 0,
                enter = fadeIn(tween(200)),
            ) {
                TypingText(
                    text = paragraph.take(snapshot.visibleCounts.getOrElse(index) { 0 }),
                    isTyping = false,
                    isTitle = false,
                    modifier = Modifier.padding(top = 18.4.dp),
                )
            }
        }
    }
}

@Composable
private fun TypingText(
    text: String,
    isTyping: Boolean,
    isTitle: Boolean,
    modifier: Modifier = Modifier,
) {
    val fontSize = if (isTitle) 16.sp else 12.5.sp
    // 光标闪烁：对齐 iOS 0.38s 周期
    var cursorOn by remember { mutableStateOf(true) }
    LaunchedEffect(isTyping) {
        while (isTyping) {
            delay(380)
            cursorOn = !cursorOn
        }
        cursorOn = false
    }
    Text(
        text = if (isTyping && cursorOn) text + "▍" else text,
        fontSize = fontSize,
        fontWeight = if (isTitle) FontWeight.SemiBold else FontWeight.Normal,
        letterSpacing = (-0.035 * fontSize.value).sp,
        lineHeight = if (isTitle) fontSize else fontSize * 1.32,
        color = if (isTitle) PSColors.ink else PSColors.quiet,
        modifier = modifier.fillMaxWidth(),
    )
}

/** 首访隐藏占位：保持布局高度（对齐 iOS fullText.hidden()）。 */
@Composable
fun BioFullTextHidden() {
    Column(Modifier.fillMaxWidth().alpha(0f)) {
        TypingText(BioCopy.chineseTitle, isTyping = false, isTitle = true)
        BioCopy.profileCopy.forEach { paragraph ->
            TypingText(paragraph, isTyping = false, isTitle = false, modifier = Modifier.padding(top = 18.4.dp))
        }
    }
}
