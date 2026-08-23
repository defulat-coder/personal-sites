package com.personalsite.features.opensource

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.personalsite.core.PSColors
import com.personalsite.core.SiteApiClient
import com.personalsite.features.support.LoadStateView
import com.personalsite.models.RepositoryFileResponse
import com.personalsite.models.RepositoryTreeEntry
import com.personalsite.models.RepositoryTreeResponse
import java.util.Locale
import kotlinx.coroutines.launch

/** 页面小标题（对齐 iOS navigationTitle）：目录 path 为空显示「仓库」，否则最后一段；文件取最后一段。 */
@Composable
private fun BrowserHeader(title: String) {
    Text(
        text = title,
        fontSize = 17.sp,
        fontWeight = FontWeight.SemiBold,
        color = PSColors.ink,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

/**
 * 仓库目录页：经 /api/open-source/{slug}/repository/tree 拉全量树（服务端有缓存），
 * 每层按路径前缀过滤出直接子项，目录在前。
 */
@Composable
fun RepositoryDirectoryView(
    slug: String,
    path: String,
    onOpenDirectory: (String, String) -> Unit,
    onOpenFile: (String, String) -> Unit,
) {
    var entries by remember { mutableStateOf<List<RepositoryTreeEntry>>(emptyList()) }
    var truncated by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { SiteApiClient() }

    suspend fun load() {
        isLoading = true
        errorMessage = null
        try {
            val tree: RepositoryTreeResponse = api.get("/api/open-source/$slug/repository/tree")
            entries = tree.entries
            truncated = tree.truncated
        } catch (e: Exception) {
            errorMessage = "读取仓库目录失败，请稍后重试。"
        }
        isLoading = false
    }

    LaunchedEffect(slug) { load() }

    // 直接子项：路径以当前目录为前缀且剩余部分不含 "/"
    val prefix = if (path.isEmpty()) "" else "$path/"
    val children = entries
        .filter { it.path.startsWith(prefix) && !it.path.substring(prefix.length).contains('/') }
        .sortedWith(compareBy({ it.type != RepositoryTreeEntry.EntryType.TREE }, { it.name }))

    Column(Modifier.fillMaxSize()) {
        BrowserHeader(title = if (path.isEmpty()) "仓库" else path.substringAfterLast('/'))
        LoadStateView(
            isLoading = isLoading,
            errorMessage = errorMessage,
            isEmpty = children.isEmpty(),
            emptyMessage = "目录为空",
            onRetry = { scope.launch { load() } },
        ) {
            LazyColumn(Modifier.fillMaxSize()) {
                if (truncated) {
                    item(key = "truncated-hint") {
                        Text(
                            text = "仓库较大，仅展示部分条目",
                            fontSize = 12.sp,
                            color = PSColors.quiet,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                }
                items(children, key = { it.path }) { entry ->
                    if (entry.type == RepositoryTreeEntry.EntryType.TREE) {
                        DirectoryRow(name = entry.name, onClick = { onOpenDirectory(slug, entry.path) })
                    } else {
                        FileRow(
                            name = entry.name,
                            sizeText = entry.size?.let(::sizeText),
                            onClick = { onOpenFile(slug, entry.path) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DirectoryRow(name: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.Folder,
            contentDescription = null,
            tint = PSColors.ink,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(name, color = PSColors.ink)
    }
}

@Composable
private fun FileRow(name: String, sizeText: String?, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Filled.Description,
            contentDescription = null,
            tint = PSColors.ink,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(8.dp))
        Text(name, color = PSColors.ink, modifier = Modifier.weight(1f))
        if (sizeText != null) {
            Text(sizeText, fontSize = 12.sp, color = PSColors.quiet)
        }
    }
}

private fun sizeText(bytes: Long): String =
    if (bytes < 1024) "$bytes B" else String.format(Locale.US, "%.1f KB", bytes / 1024.0)

/** 仓库文件页：文本内容等宽展示；二进制给 GitHub 原文件链接。 */
@Composable
fun RepositoryFileView(slug: String, path: String) {
    var file by remember { mutableStateOf<RepositoryFileResponse?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val api = remember { SiteApiClient() }
    val uriHandler = LocalUriHandler.current

    suspend fun load() {
        errorMessage = null
        try {
            file = api.get(
                "/api/open-source/$slug/repository/file",
                query = mapOf("path" to path),
            )
        } catch (e: Exception) {
            errorMessage = "读取文件失败，请稍后重试。"
        }
    }

    LaunchedEffect(slug, path) { load() }

    Column(Modifier.fillMaxSize()) {
        BrowserHeader(title = path.substringAfterLast('/'))
        LoadStateView(
            isLoading = file == null && errorMessage == null,
            errorMessage = errorMessage,
            isEmpty = false,
            emptyMessage = "",
            onRetry = { scope.launch { load() } },
        ) {
            file?.let { current ->
                if (current.binary) {
                    Box(Modifier.fillMaxSize().padding(24.dp)) {
                        Column(
                            modifier = Modifier.align(Alignment.Center),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Description,
                                contentDescription = null,
                                tint = PSColors.quiet,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text("二进制文件，无法预览", color = PSColors.ink, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { uriHandler.openUri(current.fileUrl) }) {
                                Text("在 GitHub 查看")
                            }
                        }
                    }
                } else {
                    SelectionContainer(
                        Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .horizontalScroll(rememberScrollState()),
                    ) {
                        Text(
                            text = current.content.orEmpty(),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = PSColors.ink,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
            }
        }
    }
}
