package com.personalsite.features.support

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.LocalPrintshop
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.R
import com.personalsite.core.PSColors
import com.personalsite.core.PSTheme
import com.personalsite.features.home.CareerTimelineView
import com.personalsite.features.home.ProfileHeaderInsets

/** 月亮/太阳切换（对齐 iOS ThemeToggleButton）。 */
@Composable
fun ThemeToggleButton(theme: PSTheme, onToggle: (PSTheme) -> Unit) {
    val dark = when (theme) {
        PSTheme.SYSTEM -> androidx.compose.foundation.isSystemInDarkTheme()
        PSTheme.LIGHT -> false
        PSTheme.DARK -> true
    }
    Box(
        Modifier
            .size(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable { onToggle(if (dark) PSTheme.LIGHT else PSTheme.DARK) },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (dark) Icons.Outlined.LightMode else Icons.Outlined.DarkMode,
            contentDescription = if (dark) "切换为浅色主题" else "切换为深色主题",
            tint = PSColors.quiet,
            modifier = Modifier.size(18.dp),
        )
    }
}

/** 外链入口（图标 + 文字），对齐 Web 的 curation-home__external-links。 */
@Composable
fun ProfileLinkItem(title: String, url: String, icon: @Composable () -> Unit) {
    val uriHandler = LocalUriHandler.current
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clickable { uriHandler.openUri(url) },
    ) {
        icon()
        Spacer(Modifier.width(4.dp))
        Text(title, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PSColors.link)
    }
}

/** 链接之间的 1px 竖线分隔。 */
@Composable
fun ProfileLinkSeparator() {
    Box(Modifier.width(1.dp).height(12.dp).background(PSColors.line))
}

/**
 * 扩展版身份头（仅首页）：大头像、「陈远」粗体 + 灰 @defulat-coder 两行、
 * 链接行 GitHub｜语雀｜关于我、右上月亮，对齐 iOS ProfileHeaderContent。
 */
@Composable
fun ProfileHeaderContent(
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    onShowAbout: () -> Unit,
    careerTimelinePlayed: Boolean,
    reduceMotion: Boolean,
    onCareerTimelinePlayed: () -> Unit,
) {
    Box(Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            Image(
                painter = painterResource(R.drawable.avatar),
                contentDescription = "头像",
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .size(104.dp)
                    .clip(RoundedCornerShape(12.dp)),
            )
            Column(Modifier.height(104.dp).weight(1f).padding(top = 8.dp)) {
                Text(
                    "陈远",
                    fontSize = 15.2.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.035 * 15.2).sp,
                    color = PSColors.ink,
                )
                Text(
                    "@defulat-coder",
                    fontSize = 12.5.sp,
                    letterSpacing = (-0.02 * 12.5).sp,
                    color = PSColors.quiet,
                    modifier = Modifier.padding(top = 2.9.dp),
                )
                CareerTimelineView(
                    shouldAnimateEntrance = !careerTimelinePlayed,
                    reduceMotion = reduceMotion,
                    onEntranceCompleted = onCareerTimelinePlayed,
                )
                Spacer(Modifier.weight(1f))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(end = ProfileHeaderInsets.EXPANDED_LINKS_TRAILING.dp),
                ) {
                    ProfileLinkItem(title = "GitHub", url = "https://github.com/defulat-coder") {
                        Icon(
                            painterResource(android.R.drawable.ic_menu_share),
                            contentDescription = null,
                            tint = PSColors.link,
                            modifier = Modifier.size(10.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    ProfileLinkSeparator()
                    Spacer(Modifier.width(6.dp))
                    ProfileLinkItem(title = "语雀", url = "https://www.yuque.com/defulat-coder") {
                        Icon(
                            Icons.Outlined.Book,
                            contentDescription = null,
                            tint = PSColors.link,
                            modifier = Modifier.size(10.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    ProfileLinkSeparator()
                    Spacer(Modifier.width(6.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.clickable(onClick = onShowAbout),
                    ) {
                        Icon(
                            Icons.Outlined.LocalPrintshop,
                            contentDescription = null,
                            tint = PSColors.link,
                            modifier = Modifier.size(10.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text("关于我", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PSColors.link)
                    }
                }
            }
        }
        Box(Modifier.align(Alignment.TopEnd)) {
            ThemeToggleButton(theme = theme, onToggle = onThemeChange)
        }
    }
}

/** 内容页头部：展开态（头像+标题+副标题）/ 折叠态（标题行），对齐 iOS ContentPageHeader。 */
@Composable
fun ContentPageHeader(
    title: String,
    subtitle: String,
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    isCollapsed: Boolean = false,
    reduceMotion: Boolean = false,
) {
    AnimatedContent(
        targetState = isCollapsed,
        transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(200)) },
        label = "page-header",
        modifier = Modifier.background(PSColors.surface),
    ) { collapsed ->
        if (collapsed) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .padding(start = 16.dp, end = 8.dp),
            ) {
                Text(title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                Spacer(Modifier.weight(1f))
                ThemeToggleButton(theme = theme, onToggle = onThemeChange)
            }
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(top = 6.dp, bottom = 12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Image(
                        painter = painterResource(R.drawable.avatar),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(8.dp)),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text("陈远", fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PSColors.ink)
                    Spacer(Modifier.weight(1f))
                    ThemeToggleButton(theme = theme, onToggle = onThemeChange)
                }
                Text(
                    title,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.02 * 22).sp,
                    color = PSColors.ink,
                    modifier = Modifier.padding(top = 10.dp),
                )
                Text(
                    subtitle,
                    fontSize = 13.sp,
                    color = PSColors.quiet,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
        }
    }
    Box(Modifier.fillMaxWidth().height(0.5.dp).background(PSColors.line))
}
