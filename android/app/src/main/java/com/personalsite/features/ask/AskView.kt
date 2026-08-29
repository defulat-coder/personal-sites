package com.personalsite.features.ask

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.provider.Settings
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.DragInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowOutward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.personalsite.core.PSColors
import com.personalsite.core.PSMotion
import com.personalsite.core.SiteApiClient
import com.personalsite.features.support.MarkdownText
import com.personalsite.models.AskScope
import com.personalsite.models.AskSource
import com.personalsite.models.AskStreamEvent
import java.util.UUID
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/** visitorId 的 DataStore 持久化：仅 ANDROID_ID 取不到时使用的回落方案。 */
private val Context.askDataStore by preferencesDataStore(name = "ask")
private val visitorIdKey = stringPreferencesKey("visitor_id")

/** 服务端 visitorId 正则 ^[A-Za-z0-9_-]{16,128}$。 */
private val visitorIdPattern = Regex("^[A-Za-z0-9_-]{16,128}$")

/** 次级背景（对齐 iOS secondarySystemBackground）：line 色半透明叠加在 surface 上近似。 */
private val secondarySurface: Color @Composable get() = PSColors.line.copy(alpha = 0.6f)

data class AskMessage(
    val role: Role,
    /** LazyColumn 的稳定 key，对齐 iOS 的 UUID。 */
    val id: String = UUID.randomUUID().toString(),
) {
    enum class Role { USER, ASSISTANT }

    // Compose 快照状态：流式追加文本时直接驱动重组。
    var text by mutableStateOf("")
    var sources by mutableStateOf<List<AskSource>>(emptyList())
    var isStreaming by mutableStateOf(false)
    var failed by mutableStateOf(false)
}

/**
 * 问一问对话模型：一问一答的顺序流，服务端按 IP 限流（50 次/10 分钟）。
 * 行为逐行对齐 iOS AskChatModel。
 */
class AskChatModel(application: Application) : AndroidViewModel(application) {
    val messages = mutableStateListOf<AskMessage>()
    var input by mutableStateOf("")
    var scope by mutableStateOf(AskScope.ALL)
    var isStreaming by mutableStateOf(false)
        private set

    /** 429 / 流内 error 事件的顶部提示。 */
    var bannerMessage by mutableStateOf<String?>(null)
        private set

    private val conversationId = UUID.randomUUID().toString()

    /** ANDROID_ID 是 16 位 hex，天然过服务端正则；取不到时回落为 DataStore 持久化的随机 UUID（去连字符）。 */
    private var visitorId by mutableStateOf<String?>(null)

    private var streamJob: Job? = null

    init {
        @SuppressLint("HardwareIds")
        val androidId = Settings.Secure.getString(application.contentResolver, Settings.Secure.ANDROID_ID)
        if (androidId != null && visitorIdPattern.matches(androidId)) {
            visitorId = androidId
        } else {
            viewModelScope.launch {
                val prefs = application.askDataStore.data.first()
                val existing = prefs[visitorIdKey]
                if (existing != null) {
                    visitorId = existing
                } else {
                    val generated = UUID.randomUUID().toString().replace("-", "")
                    application.askDataStore.edit { it[visitorIdKey] = generated }
                    visitorId = generated
                }
            }
        }
    }

    val canSend: Boolean
        get() = input.isNotBlank() && !isStreaming && visitorId != null

    fun send(suggestedQuestion: String? = null) {
        val question = (suggestedQuestion ?: input).trim()
        val currentVisitorId = visitorId
        if (question.isEmpty() || isStreaming || currentVisitorId == null) return
        input = ""
        bannerMessage = null
        messages.add(AskMessage(role = AskMessage.Role.USER).apply { text = question })
        messages.add(AskMessage(role = AskMessage.Role.ASSISTANT).apply { isStreaming = true })
        isStreaming = true
        streamAnswer(question, currentVisitorId)
    }

    fun stopGenerating() {
        streamJob?.cancel()
        streamJob = null
        updateLastAssistant {
            if (it.text.isEmpty()) {
                it.text = "已停止生成。"
            }
            it.isStreaming = false
        }
        isStreaming = false
    }

    /** 离开页面时调用：取消流，停止消费事件。 */
    fun cancelStream() {
        streamJob?.cancel()
        finishStreaming()
    }

    override fun onCleared() {
        cancelStream()
        super.onCleared()
    }

    private fun finishStreaming() {
        isStreaming = false
        messages.lastOrNull()?.let { if (it.isStreaming) it.isStreaming = false }
    }

    private fun streamAnswer(question: String, visitorId: String) {
        streamJob = viewModelScope.launch {
            try {
                SiteApiClient().askEvents(
                    conversationId = conversationId,
                    visitorId = visitorId,
                    question = question,
                    scope = scope,
                ).collect { sseEvent ->
                    ensureActive()
                    when (val event = AskStreamEvent.from(sseEvent)) {
                        is AskStreamEvent.Sources -> updateLastAssistant { it.sources = event.sources }
                        is AskStreamEvent.Text -> updateLastAssistant { it.text += event.delta }
                        AskStreamEvent.Done -> Unit
                        is AskStreamEvent.Error -> {
                            updateLastAssistant { it.failed = true }
                            bannerMessage = event.message
                        }
                    }
                }
            } catch (e: CancellationException) {
                // 主动取消或离开页面：静默收尾。
            } catch (e: SiteApiClient.ApiError.RateLimited) {
                updateLastAssistant { it.failed = true }
                bannerMessage = e.retryAfterSeconds?.let { "提问过于频繁，请 $it 秒后再试。" }
                    ?: "提问过于频繁，请稍后再试。"
            } catch (e: Exception) {
                updateLastAssistant { it.failed = true }
                bannerMessage = "回答暂时不可用，请稍后重试。"
            } finally {
                finishStreaming()
            }
        }
    }

    private inline fun updateLastAssistant(mutate: (AskMessage) -> Unit) {
        messages.lastOrNull()?.let(mutate)
    }

    companion object {
        /** scope 中文标签，对齐 iOS。 */
        val scopeLabels: Map<AskScope, String> = mapOf(
            AskScope.ALL to "全部资料",
            AskScope.PROFILE to "关于我",
            AskScope.WORKS to "构建",
            AskScope.AI_NEWS to "每日动态",
            AskScope.DAILY to "每日关注",
            AskScope.OPEN_SOURCE to "开源关注",
        )
    }
}

private data class AskSuggestion(val title: String, val detail: String, val prompt: String)

/** 空态三条建议问题，文案对齐 iOS。 */
private val suggestions = listOf(
    AskSuggestion(
        title = "最近在关注什么？",
        detail = "从每日动态里找出正在发生的变化",
        prompt = "最近有哪些值得持续跟踪的 Agent 工程？",
    ),
    AskSuggestion(
        title = "哪些项目值得尝试？",
        detail = "结合推荐内容与开源判断给出答案",
        prompt = "哪些开源项目已经被提炼或计划试用？",
    ),
    AskSuggestion(
        title = "现在正在构建什么？",
        detail = "从工程档案总结当前验证方向",
        prompt = "目前正在构建和验证什么？",
    ),
)

/** 「问一问」SSE 流式对话页，对齐 iOS AskView。 */
@Composable
fun AskView(
    reduceMotion: Boolean,
    model: AskChatModel = viewModel(),
) {
    val listState = rememberLazyListState()
    var followsLatest by remember { mutableStateOf(true) }
    val keyboard = LocalSoftwareKeyboardController.current

    // 用户上滑（拖动）后暂停跟随最新，并收起键盘。
    LaunchedEffect(listState) {
        listState.interactionSource.interactions.collect { interaction ->
            if (interaction is DragInteraction.Start) {
                followsLatest = false
                keyboard?.hide()
            }
        }
    }
    // 新消息加入：恢复跟随并动画滚到底部。
    LaunchedEffect(model.messages.size) {
        if (model.messages.isEmpty()) return@LaunchedEffect
        followsLatest = true
        val last = listState.layoutInfo.totalItemsCount - 1
        if (last >= 0) listState.animateScrollToItem(last)
    }
    // streaming 文本更新：跟随时不带动画贴底。
    LaunchedEffect(listState) {
        snapshotFlow { model.messages.lastOrNull()?.text }.collect {
            if (!followsLatest || model.messages.isEmpty()) return@collect
            val last = listState.layoutInfo.totalItemsCount - 1
            if (last >= 0) listState.scrollToItem(last)
        }
    }
    // 离开页面：取消流，停止消费事件。
    DisposableEffect(model) {
        onDispose { model.cancelStream() }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(PSColors.surface)
            .imePadding(),
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item(key = "banner") {
                AnimatedVisibility(visible = model.bannerMessage != null) {
                    Text(
                        text = model.bannerMessage.orEmpty(),
                        fontSize = 13.sp,
                        color = PSColors.quiet,
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(secondarySurface, RoundedCornerShape(8.dp))
                            .padding(8.dp),
                    )
                }
            }
            if (model.messages.isEmpty()) {
                item(key = "empty-state") {
                    AskEmptyState(
                        suggestions = suggestions,
                        onSelect = { suggestion ->
                            keyboard?.hide()
                            model.send(suggestion.prompt)
                        },
                        modifier = Modifier.padding(top = 24.dp),
                    )
                }
            }
            items(model.messages, key = { it.id }) { message ->
                MessageEnter(reduceMotion = reduceMotion) {
                    AskMessageBubble(message = message)
                }
            }
            // 底部锚点，对齐 iOS 的 bottomID。
            item(key = "ask-bottom") {
                Spacer(Modifier.height(1.dp))
            }
        }
        AskComposer(model = model)
    }
}

/** 消息进入动画：reduceMotion 时只用 fade，否则偏移 + 淡入。 */
@Composable
private fun MessageEnter(reduceMotion: Boolean, content: @Composable () -> Unit) {
    var appeared by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { appeared = true }
    AnimatedVisibility(
        visible = appeared,
        enter = if (reduceMotion) {
            fadeIn(tween(PSMotion.STATE_CHANGE_MS))
        } else {
            fadeIn(tween(PSMotion.STATE_CHANGE_MS)) +
                slideInVertically(tween(PSMotion.STATE_CHANGE_MS)) { it / 4 }
        },
    ) {
        content()
    }
}

@Composable
private fun AskEmptyState(
    suggestions: List<AskSuggestion>,
    onSelect: (AskSuggestion) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxWidth()) {
        Text(
            text = "从哪里开始？",
            fontSize = 22.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.44).sp,
            color = PSColors.ink,
        )
        Text(
            text = "直接提问，回答只基于这个站点已经公开的内容。",
            fontSize = 13.5.sp,
            color = PSColors.quiet,
            modifier = Modifier.padding(top = 4.dp, bottom = 18.dp),
        )
        suggestions.forEach { suggestion ->
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier
                    .padding(bottom = 10.dp)
                    .fillMaxWidth()
                    .heightIn(min = 66.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(PSColors.line.copy(alpha = 0.18f))
                    .clickable { onSelect(suggestion) }
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        text = suggestion.title,
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PSColors.ink,
                    )
                    Text(
                        text = suggestion.detail,
                        fontSize = 12.5.sp,
                        color = PSColors.quiet,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Icon(
                    imageVector = Icons.Filled.ArrowOutward,
                    contentDescription = null,
                    tint = PSColors.quiet,
                    modifier = Modifier
                        .padding(top = 2.dp)
                        .size(14.dp),
                )
            }
        }
    }
}

@Composable
private fun AskMessageBubble(message: AskMessage) {
    when (message.role) {
        AskMessage.Role.USER -> {
            // 用户消息：右对齐实心气泡。
            Box(
                contentAlignment = Alignment.CenterEnd,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 64.dp),
            ) {
                SelectionContainer {
                    Text(
                        text = message.text,
                        fontSize = 15.sp,
                        color = PSColors.surface,
                        modifier = Modifier
                            .background(PSColors.ink, RoundedCornerShape(18.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }
        }
        AskMessage.Role.ASSISTANT -> {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (message.text.isEmpty() && message.isStreaming) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                            color = PSColors.quiet,
                        )
                        Text(
                            text = "正在整理公开资料…",
                            fontSize = 13.5.sp,
                            color = PSColors.quiet,
                        )
                    }
                } else {
                    SelectionContainer {
                        MarkdownText(markdown = message.text)
                    }
                }
                if (message.failed) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Warning,
                            contentDescription = null,
                            tint = PSColors.quiet,
                            modifier = Modifier.size(12.dp),
                        )
                        Text(
                            text = "这条回答不完整",
                            fontSize = 12.sp,
                            color = PSColors.quiet,
                        )
                    }
                }
                if (message.sources.isNotEmpty()) {
                    AskSources(sources = message.sources)
                }
            }
        }
    }
}

/** 来源链接列表：合法 http(s) 地址渲染为可点链接，否则退化为纯文本。 */
@Composable
private fun AskSources(sources: List<AskSource>) {
    val uriHandler = LocalUriHandler.current
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(text = "来源", fontSize = 12.sp, color = PSColors.quiet)
        sources.forEach { source ->
            val isLink = source.sourceUrl.startsWith("http://") || source.sourceUrl.startsWith("https://")
            Text(
                text = source.title,
                fontSize = 13.sp,
                color = if (isLink) PSColors.link else PSColors.quiet,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = if (isLink) {
                    Modifier.clickable { uriHandler.openUri(source.sourceUrl) }
                } else {
                    Modifier
                },
            )
        }
    }
}

/** 底部输入条：多行输入 + 范围下拉 + 发送/停止圆钮。 */
@Composable
private fun AskComposer(model: AskChatModel) {
    val canSubmitOrStop = model.isStreaming || model.canSend
    Column(
        Modifier
            .fillMaxWidth()
            .background(PSColors.surface.copy(alpha = 0.96f))
            .padding(horizontal = 12.dp)
            .padding(bottom = 8.dp),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .background(secondarySurface, RoundedCornerShape(22.dp))
                .border(0.5.dp, PSColors.line, RoundedCornerShape(22.dp))
                .padding(start = 14.dp, end = 8.dp, top = 12.dp, bottom = 6.dp),
        ) {
            BasicTextField(
                value = model.input,
                onValueChange = { model.input = it },
                modifier = Modifier.fillMaxWidth(),
                textStyle = TextStyle(fontSize = 16.sp, color = PSColors.ink),
                maxLines = 5,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { model.send() }),
                cursorBrush = SolidColor(PSColors.ink),
                decorationBox = { innerTextField ->
                    Box {
                        if (model.input.isEmpty()) {
                            Text(text = "问任何公开记录…", fontSize = 16.sp, color = PSColors.quiet)
                        }
                        innerTextField()
                    }
                },
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                ScopeMenu(model = model)
                Spacer(Modifier.weight(1f))
                SendButton(
                    isStreaming = model.isStreaming,
                    enabled = canSubmitOrStop,
                    onClick = {
                        if (model.isStreaming) model.stopGenerating() else model.send()
                    },
                )
            }
        }
    }
}

/** 检索范围下拉菜单，流式期间禁用。 */
@Composable
private fun ScopeMenu(model: AskChatModel) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            modifier = Modifier
                .heightIn(min = 32.dp)
                .clip(RoundedCornerShape(8.dp))
                .clickable(enabled = !model.isStreaming) { expanded = true }
                .padding(horizontal = 8.dp),
        ) {
            Icon(
                imageVector = Icons.Filled.FilterList,
                contentDescription = null,
                tint = PSColors.quiet,
                modifier = Modifier.size(14.dp),
            )
            Text(
                text = AskChatModel.scopeLabels[model.scope].orEmpty(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = PSColors.quiet,
            )
            Icon(
                imageVector = Icons.Filled.KeyboardArrowDown,
                contentDescription = null,
                tint = PSColors.quiet,
                modifier = Modifier.size(12.dp),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            AskScope.entries.forEach { option ->
                DropdownMenuItem(
                    text = { Text(AskChatModel.scopeLabels[option] ?: option.name) },
                    onClick = {
                        model.scope = option
                        expanded = false
                    },
                )
            }
        }
    }
}

/** 发送/停止圆形按钮：32dp 图标区 + 44dp 触摸区。 */
@Composable
private fun SendButton(isStreaming: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .semantics { contentDescription = if (isStreaming) "停止生成" else "发送" },
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(32.dp)
                .background(if (enabled) PSColors.ink else PSColors.line, CircleShape),
        ) {
            Icon(
                imageVector = if (isStreaming) Icons.Filled.Stop else Icons.Filled.ArrowUpward,
                contentDescription = null,
                tint = if (enabled) PSColors.surface else PSColors.quiet,
                modifier = Modifier.size(16.dp),
            )
        }
    }
}
