package com.personalsite

import android.content.Context
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.personalsite.core.PSColors
import com.personalsite.core.PSTheme
import com.personalsite.core.PersonalSiteTheme
import com.personalsite.features.ainews.AiNewsDetailView
import com.personalsite.features.ainews.AiNewsView
import com.personalsite.features.ask.AskView
import com.personalsite.features.home.HomeView
import com.personalsite.features.support.AboutPrintView
import com.personalsite.features.support.AppTab
import com.personalsite.features.support.ContentPageHeader
import com.personalsite.features.support.FollowingView
import com.personalsite.features.support.WelcomeAnimationView
import com.personalsite.features.works.WorksView
import kotlinx.coroutines.launch

private val Context.dataStore by preferencesDataStore(name = "settings")
private val KEY_THEME = stringPreferencesKey("curation-theme")
private val KEY_HAS_SEEN_WELCOME = booleanPreferencesKey("hasSeenWelcome")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppRoot()
        }
    }
}

@Composable
fun AppRoot() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs by context.dataStore.data.collectAsState(initial = null)

    val theme = PSTheme.from(prefs?.get(KEY_THEME))
    // DataStore 未就绪前不闪屏：默认跟随系统
    val hasSeenWelcome = prefs?.get(KEY_HAS_SEEN_WELCOME) ?: true

    // 系统「移除动画」：Animator Duration Scale 为 0 视为 reduce motion
    val reduceMotion = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }

    // 前后台状态（信号场等动画暂停用）
    var sceneIsActive by remember { mutableStateOf(true) }
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            sceneIsActive = event != Lifecycle.Event.ON_STOP
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    PersonalSiteTheme(theme = theme) {
        Box(Modifier.fillMaxSize().background(PSColors.surface)) {
            TabSurface(
                theme = theme,
                onThemeChange = { newTheme ->
                    scope.launch { context.dataStore.edit { it[KEY_THEME] = newTheme.stored } }
                },
                reduceMotion = reduceMotion,
                sceneIsActive = sceneIsActive,
                loaderFinished = hasSeenWelcome,
            )

            AnimatedVisibility(
                visible = !hasSeenWelcome,
                exit = fadeOut(tween(200)),
            ) {
                WelcomeAnimationView(
                    reduceMotion = reduceMotion,
                    onFinished = {
                        scope.launch { context.dataStore.edit { it[KEY_HAS_SEEN_WELCOME] = true } }
                    },
                )
            }
        }
    }
}

@Composable
private fun TabSurface(
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    reduceMotion: Boolean,
    sceneIsActive: Boolean,
    loaderFinished: Boolean,
) {
    var selectedTab by rememberSaveable { mutableStateOf(AppTab.HOME.name) }
    var bioPlayed by rememberSaveable { mutableStateOf(false) }
    var careerTimelinePlayed by rememberSaveable { mutableStateOf(false) }
    var showsAbout by remember { mutableStateOf(false) }

    val tab = AppTab.valueOf(selectedTab)

    Scaffold(
        containerColor = PSColors.surface,
        bottomBar = {
            NavigationBar(containerColor = PSColors.surface) {
                AppTab.entries.forEach { option ->
                    NavigationBarItem(
                        selected = tab == option,
                        onClick = { selectedTab = option.name },
                        icon = {
                            Icon(
                                when (option) {
                                    AppTab.HOME -> Icons.Outlined.Home
                                    AppTab.AI_NEWS -> Icons.Outlined.Schedule
                                    AppTab.FOLLOWING -> Icons.Outlined.Bookmark
                                    AppTab.WORKS -> Icons.Outlined.Inventory2
                                    AppTab.ASK -> Icons.Outlined.ChatBubbleOutline
                                },
                                contentDescription = option.label,
                            )
                        },
                        label = { Text(option.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = PSColors.ink,
                            selectedTextColor = PSColors.ink,
                            unselectedIconColor = PSColors.quiet,
                            unselectedTextColor = PSColors.quiet,
                            indicatorColor = PSColors.line.copy(alpha = 0.5f),
                        ),
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(Modifier.padding(innerPadding)) {
            when (tab) {
                AppTab.HOME -> HomeView(
                    theme = theme,
                    onThemeChange = onThemeChange,
                    loaderFinished = loaderFinished,
                    bioPlayed = bioPlayed,
                    onBioPlayed = { bioPlayed = true },
                    careerTimelinePlayed = careerTimelinePlayed,
                    onCareerTimelinePlayed = { careerTimelinePlayed = true },
                    onShowAbout = { showsAbout = true },
                    reduceMotion = reduceMotion,
                    sceneIsActive = sceneIsActive,
                )
                AppTab.AI_NEWS -> AiNewsTabView(theme = theme, onThemeChange = onThemeChange, reduceMotion = reduceMotion)
                AppTab.FOLLOWING -> FollowingView(theme = theme, onThemeChange = onThemeChange, reduceMotion = reduceMotion)
                AppTab.WORKS -> WorksTabView(theme = theme, onThemeChange = onThemeChange, reduceMotion = reduceMotion)
                AppTab.ASK -> ContentTabScreen(
                    title = "问一问",
                    subtitle = "从公开动态、关注与工程记录中寻找答案",
                    theme = theme,
                    onThemeChange = onThemeChange,
                ) {
                    AskView(reduceMotion = reduceMotion)
                }
            }

            AnimatedVisibility(
                visible = showsAbout,
                enter = fadeIn(tween(200)),
                exit = fadeOut(tween(200)),
            ) {
                AboutPrintView(reduceMotion = reduceMotion, onDismiss = { showsAbout = false })
            }
        }
    }
}

@Composable
private fun AiNewsTabView(theme: PSTheme, onThemeChange: (PSTheme) -> Unit, reduceMotion: Boolean) {
    var headerCollapsed by rememberSaveable { mutableStateOf(false) }
    val navController = rememberNavController()
    Column(Modifier.fillMaxSize().background(PSColors.surface)) {
        ContentPageHeader(
            title = "每日动态",
            subtitle = "按时间跟踪正在发生的 AI 与 Agent 变化",
            theme = theme,
            onThemeChange = onThemeChange,
            isCollapsed = headerCollapsed,
            reduceMotion = reduceMotion,
        )
        NavHost(navController = navController, startDestination = "list") {
            composable("list") {
                AiNewsView(
                    onOpenDetail = { id -> navController.navigate("detail/$id") },
                    onHeaderCollapse = { headerCollapsed = it },
                )
            }
            composable("detail/{id}") { entry ->
                AiNewsDetailView(id = entry.arguments?.getString("id").orEmpty())
            }
        }
    }
}

@Composable
private fun WorksTabView(theme: PSTheme, onThemeChange: (PSTheme) -> Unit, reduceMotion: Boolean) {
    var headerCollapsed by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(PSColors.surface)) {
        ContentPageHeader(
            title = "构建",
            subtitle = "正在运行、验证和持续维护的工程",
            theme = theme,
            onThemeChange = onThemeChange,
            isCollapsed = headerCollapsed,
            reduceMotion = reduceMotion,
        )
        WorksView(onHeaderCollapse = { headerCollapsed = it })
    }
}

@Composable
private fun ContentTabScreen(
    title: String,
    subtitle: String,
    theme: PSTheme,
    onThemeChange: (PSTheme) -> Unit,
    content: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(PSColors.surface)) {
        ContentPageHeader(title = title, subtitle = subtitle, theme = theme, onThemeChange = onThemeChange)
        content()
    }
}
