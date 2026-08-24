package com.personalsite.features.support

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.personalsite.core.PSColors
import com.personalsite.core.PSTheme
import com.personalsite.features.curation.CurationDetailView
import com.personalsite.features.curation.CurationView
import com.personalsite.features.opensource.OpenSourceRoute
import com.personalsite.features.opensource.OpenSourceView
import com.personalsite.features.opensource.RepositoryDirectoryView
import com.personalsite.features.opensource.RepositoryFileView

/**
 * 「关注」Tab：推荐（每日关注）/ 开源 双模式分段切换（对齐 iOS FollowingView）。
 * 每个模式持有自己的导航栈。
 */
@Composable
fun FollowingView(
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    reduceMotion: Boolean,
) {
    var mode by rememberSaveable { mutableStateOf(FollowingMode.RECOMMENDATIONS.name) }
    var headerCollapsed by rememberSaveable { mutableStateOf(false) }
    val currentMode = FollowingMode.valueOf(mode)

    Column(Modifier.fillMaxSize().background(PSColors.surface)) {
        ContentPageHeader(
            title = "关注",
            subtitle = "值得继续阅读、试用和长期跟踪的内容",
            theme = theme,
            onThemeChange = onThemeChange,
            isCollapsed = headerCollapsed,
            reduceMotion = reduceMotion,
        )
        if (!headerCollapsed) {
            SingleChoiceSegmentedButtonRow(
                Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                FollowingMode.entries.forEachIndexed { index, option ->
                    SegmentedButton(
                        selected = currentMode == option,
                        onClick = {
                            mode = option.name
                            headerCollapsed = false
                        },
                        shape = SegmentedButtonDefaults.itemShape(
                            index = index,
                            count = FollowingMode.entries.size,
                        ),
                    ) {
                        Text(option.label)
                    }
                }
            }
        }

        Crossfade(targetState = currentMode, animationSpec = tween(200), label = "following-mode") { m ->
            when (m) {
                FollowingMode.RECOMMENDATIONS -> CurationNavHost(onHeaderCollapse = { headerCollapsed = it })
                FollowingMode.OPEN_SOURCE -> OpenSourceNavHost(onHeaderCollapse = { headerCollapsed = it })
            }
        }
    }
}

@Composable
private fun CurationNavHost(onHeaderCollapse: (Boolean) -> Unit) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "list") {
        composable("list") {
            CurationView(
                onOpenDetail = { id -> navController.navigate("detail/$id") },
                onHeaderCollapse = onHeaderCollapse,
            )
        }
        composable("detail/{id}") { entry ->
            CurationDetailView(id = entry.arguments?.getString("id").orEmpty())
        }
    }
}

@Composable
private fun OpenSourceNavHost(onHeaderCollapse: (Boolean) -> Unit) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "list") {
        composable("list") {
            OpenSourceView(
                onOpenDetail = { slug -> navController.navigate("detail/$slug") },
                onHeaderCollapse = onHeaderCollapse,
            )
        }
        composable("detail/{slug}") { entry ->
            com.personalsite.features.opensource.OpenSourceDetailView(
                slug = entry.arguments?.getString("slug").orEmpty(),
                onBrowseRepository = { slug -> navController.navigate("tree/$slug?path=") },
            )
        }
        composable("tree/{slug}?path={path}") { entry ->
            RepositoryDirectoryView(
                slug = entry.arguments?.getString("slug").orEmpty(),
                path = entry.arguments?.getString("path").orEmpty(),
                onOpenDirectory = { slug, path -> navController.navigate("tree/$slug?path=$path") },
                onOpenFile = { slug, path -> navController.navigate("file/$slug?path=$path") },
            )
        }
        composable("file/{slug}?path={path}") { entry ->
            RepositoryFileView(
                slug = entry.arguments?.getString("slug").orEmpty(),
                path = entry.arguments?.getString("path").orEmpty(),
            )
        }
    }
}
