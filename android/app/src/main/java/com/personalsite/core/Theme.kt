package com.personalsite.core

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** 站点配色：对齐 globals.css 的 light/dark 两组变量与 iOS Theme.swift。 */
object PSColors {
    /** --ink：#1c1c1e / #f4f4f4 */
    val ink: Color @Composable get() = if (isSystemInDarkTheme()) Color(0xFFF4F4F4) else Color(0xFF1C1C1E)

    /** --quiet（meta 灰）：#767676 / #999 */
    val quiet: Color @Composable get() = if (isSystemInDarkTheme()) Color(0xFF999999) else Color(0xFF767676)

    /** 链接灰：#6f6f72 / #b8b8bb */
    val link: Color @Composable get() = if (isSystemInDarkTheme()) Color(0xFFB8B8BB) else Color(0xFF6F6F72)

    /** --line（hairline）：#eee / #333 */
    val line: Color @Composable get() = if (isSystemInDarkTheme()) Color(0xFF333333) else Color(0xFFEEEEEE)

    /** --surface：#fff / #181818 */
    val surface: Color @Composable get() = if (isSystemInDarkTheme()) Color(0xFF181818) else Color.White

    val batteryRed = Color(0xFFEF4444)
    val batteryYellow = Color(0xFFF2C94C)
    val batteryGreen = Color(0xFF24CB71)
    val batteryStroke = Color(0xFF161616)
}

/** 主题模式：与 Web localStorage / iOS AppStorage 同名概念（默认跟随系统）。 */
enum class PSTheme(val stored: String) {
    SYSTEM("system"),
    LIGHT("light"),
    DARK("dark"),
    ;

    companion object {
        fun from(stored: String?): PSTheme = entries.firstOrNull { it.stored == stored } ?: SYSTEM
    }
}

@Composable
fun PersonalSiteTheme(theme: PSTheme, content: @Composable () -> Unit) {
    val dark = when (theme) {
        PSTheme.SYSTEM -> isSystemInDarkTheme()
        PSTheme.LIGHT -> false
        PSTheme.DARK -> true
    }
    val scheme = if (dark) {
        darkColorScheme(
            background = Color(0xFF181818),
            surface = Color(0xFF181818),
            onBackground = Color(0xFFF4F4F4),
            onSurface = Color(0xFFF4F4F4),
        )
    } else {
        lightColorScheme(
            background = Color.White,
            surface = Color.White,
            onBackground = Color(0xFF1C1C1E),
            onSurface = Color(0xFF1C1C1E),
        )
    }
    MaterialTheme(colorScheme = scheme, content = content)
}
