package com.personalsite.core

import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween

/**
 * 共享原生动效参数（对齐 iOS PSMotion）。
 * 系统「移除动画」开启时，各视图退化为仅透明度反馈。
 */
object PSMotion {
    val press = tween<Float>(durationMillis = 160, easing = EaseOut)
    const val STATE_CHANGE_MS = 200
    const val SECTION_MS = 280
    val profile = spring<Float>(stiffness = 400f)
    const val SYMBOL_MS = 180
}
