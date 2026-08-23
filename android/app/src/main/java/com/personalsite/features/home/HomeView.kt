package com.personalsite.features.home

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.personalsite.core.PSColors
import com.personalsite.core.PSTheme
import com.personalsite.features.support.ProfileHeaderContent

/** 首页：扩展版身份头 + 信号场弹幕 + Bio 打字机（对齐 iOS HomeView）。 */
@Composable
fun HomeView(
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    loaderFinished: Boolean,
    bioPlayed: Boolean,
    onBioPlayed: () -> Unit,
    careerTimelinePlayed: Boolean,
    onCareerTimelinePlayed: () -> Unit,
    onShowAbout: () -> Unit,
    reduceMotion: Boolean,
    sceneIsActive: Boolean,
) {
    Column(
        Modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 32.dp),
    ) {
        ProfileHeaderContent(
            theme = theme,
            onThemeChange = onThemeChange,
            onShowAbout = onShowAbout,
            careerTimelinePlayed = careerTimelinePlayed,
            reduceMotion = reduceMotion,
            onCareerTimelinePlayed = onCareerTimelinePlayed,
        )
        SignalFieldView(
            reduceMotion = reduceMotion,
            sceneIsActive = sceneIsActive,
            modifier = Modifier.padding(top = 26.4.dp),
        )
        BioView(
            startSignal = loaderFinished,
            shouldPlaySequence = !bioPlayed,
            reduceMotion = reduceMotion,
            onSequenceCompleted = onBioPlayed,
        )
        // 底部留白（对齐 iOS padding bottom 28.8）
        androidx.compose.foundation.layout.Spacer(Modifier.padding(bottom = 28.8.dp))
    }
}
