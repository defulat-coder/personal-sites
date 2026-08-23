package com.personalsite.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 开源关注模型，对齐 lib/open-source-types.ts。
 * 列表/详情走 github_open_source_items 的 PostgREST 投影（select 别名后已是 camelCase），默认解码即可。
 */

@Serializable
enum class OpenSourceCategory(val label: String) {
    @SerialName("all") ALL("全部"),
    @SerialName("skills") SKILLS("Skills 与工作流"),
    @SerialName("agents") AGENTS("智能体系统"),
    @SerialName("context") CONTEXT("智能体上下文"),
    @SerialName("tools") TOOLS("AI 开发工具"),
}

@Serializable
enum class OpenSourceDimension(val label: String) {
    @SerialName("agent-skills") AGENT_SKILLS("Agent Skills"),
    @SerialName("coding-agent") CODING_AGENT("Coding Agent"),
    @SerialName("agent-runtime") AGENT_RUNTIME("Agent 运行时"),
    @SerialName("long-running") LONG_RUNNING("长程 Agent"),
    @SerialName("multi-agent") MULTI_AGENT("多智能体协作"),
    @SerialName("agent-control") AGENT_CONTROL("Agent 控制面"),
    @SerialName("agent-infra") AGENT_INFRA("Agent 基础设施"),
    @SerialName("agent-context") AGENT_CONTEXT("Agent 上下文"),
    @SerialName("local-retrieval") LOCAL_RETRIEVAL("本地检索"),
    @SerialName("model-gateway") MODEL_GATEWAY("模型网关"),
    @SerialName("ai-ingestion") AI_INGESTION("AI 数据入口"),
}

@Serializable
enum class OpenSourceStatus(val raw: String) {
    @SerialName("持续跟踪") TRACKING("持续跟踪"),
    @SerialName("计划试用") PLANNED("计划试用"),
    @SerialName("已提炼") DISTILLED("已提炼"),
}

@Serializable
enum class OpenSourceEvidenceKind {
    @SerialName("readme") README,
    @SerialName("repository") REPOSITORY,
}

@Serializable
enum class OpenSourceReadingSource {
    @SerialName("official-zh-readme") OFFICIAL_ZH_README,
    @SerialName("kimi-translation") KIMI_TRANSLATION,
}

@Serializable
data class OpenSourceEvidence(
    val checkedAt: String,
    val kind: OpenSourceEvidenceKind,
    val label: String,
    val note: String,
    val url: String,
)

@Serializable
data class OpenSourceWorkflowStep(
    val description: String,
    val label: String,
)

/** content jsonb 的完整结构（camelCase）。 */
@Serializable
data class OpenSourceEntry(
    val category: OpenSourceCategory,
    val caveats: List<String> = emptyList(),
    val dimensions: List<OpenSourceDimension> = emptyList(),
    val evidence: OpenSourceEvidence,
    val judgement: String,
    val nextStep: String,
    val parsedMarkdown: String? = null,
    val personalNote: String,
    val repository: String,
    val repositoryDefaultBranch: String? = null,
    val repositoryUrl: String,
    val readingSource: OpenSourceReadingSource? = null,
    val readingSourcePath: String? = null,
    val scenarios: List<String> = emptyList(),
    val slug: String,
    val sourceMarkdown: String? = null,
    val sourceSummary: String,
    val sourceTitle: String? = null,
    val status: OpenSourceStatus,
    val type: String,
    val workflow: List<OpenSourceWorkflowStep> = emptyList(),
) {
    val id: String get() = slug
}

/** 列表投影（对齐 OpenSourceListEntry）：长 Markdown 不进列表。 */
@Serializable
data class OpenSourceListEntry(
    val category: OpenSourceCategory,
    val checkedAt: String,
    val dimensions: List<OpenSourceDimension> = emptyList(),
    val repository: String,
    val slug: String,
    val sourceSummary: String,
    val status: OpenSourceStatus,
    val type: String,
) {
    val id: String get() = slug
}

/** /api/open-source/[slug]/repository/tree 的响应。 */
@Serializable
data class RepositoryTreeResponse(
    val branch: String,
    val entries: List<RepositoryTreeEntry>,
    val repository: String,
    val repositoryUrl: String,
    val truncated: Boolean,
)

@Serializable
data class RepositoryTreeEntry(
    val path: String,
    val size: Long? = null,
    val type: EntryType,
) {
    @Serializable
    enum class EntryType {
        @SerialName("blob") BLOB,
        @SerialName("tree") TREE,
    }

    val name: String get() = path.substringAfterLast('/')
}

/** /api/open-source/[slug]/repository/file 的响应；binary 时 content 为 null。 */
@Serializable
data class RepositoryFileResponse(
    val binary: Boolean,
    val branch: String,
    val content: String? = null,
    val fileUrl: String,
    val path: String,
    val repository: String,
)
