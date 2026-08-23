package com.personalsite.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 作品档案模型，对齐 lib/works-types.ts；snapshot jsonb 结构对齐 lib/works.ts 顶部的 zod schema。
 */

@Serializable
data class WorkShot(
    val label: String,
    val src: String,
)

@Serializable
enum class WorkRecordKind(val label: String) {
    @SerialName("capability") CAPABILITY("当前能力"),
    @SerialName("decision") DECISION("关键决策"),
    @SerialName("experiment") EXPERIMENT("实验记录"),
    @SerialName("milestone") MILESTONE("项目里程碑"),
    @SerialName("practice") PRACTICE("沉淀实践"),
}

@Serializable
enum class WorkEvidenceKind {
    @SerialName("commit") COMMIT,
    @SerialName("document") DOCUMENT,
    @SerialName("private-verification") PRIVATE_VERIFICATION,
}

@Serializable
data class WorkEvidence(
    val id: String,
    val kind: WorkEvidenceKind,
    val label: String,
    val occurredAt: String? = null,
    val url: String? = null,
    val verifiedAt: String? = null,
)

@Serializable
data class WorkRecord(
    val bodyMarkdown: String? = null,
    val evidence: List<WorkEvidence> = emptyList(),
    val id: String,
    val kind: WorkRecordKind,
    val occurredAt: String? = null,
    val relatedRecordIds: List<String> = emptyList(),
    val status: String,
    val summary: String,
    val title: String,
    val topics: List<String> = emptyList(),
    val updatedAt: String,
)

/** snapshot jsonb 结构（camelCase），对齐 publicWorkSnapshotSchema。 */
@Serializable
data class WorkSnapshot(
    val bodyMarkdown: String? = null,
    val currentFocus: String,
    val period: String,
    val projectId: String,
    val records: List<WorkRecord> = emptyList(),
    val repo: String? = null,
    val role: String,
    val shots: List<WorkShot> = emptyList(),
    val slug: String,
    val sourceObservedAt: String? = null,
    val stack: List<String> = emptyList(),
    val status: String,
    val summary: String,
    val title: String,
    val url: String? = null,
    val version: Int,
)

/** project_public_snapshots 表行：外层 snake_case 列名，snapshot jsonb 内 camelCase，分层解码。 */
@Serializable
data class WorkPublicRow(
    @SerialName("display_order") val displayOrder: Int,
    @SerialName("published_at") val publishedAt: String,
    val snapshot: WorkSnapshot,
)

/** 对齐 Web 的 Work：snapshot 平铺 + 行级 display_order/published_at。 */
data class Work(
    val body: String,
    val currentFocus: String,
    val order: Int,
    val period: String,
    val publishedAt: String,
    val records: List<WorkRecord>,
    val repo: String?,
    val role: String,
    val shots: List<WorkShot>,
    val slug: String,
    val sourceObservedAt: String?,
    val stack: List<String>,
    val status: String,
    val summary: String,
    val title: String,
    val url: String?,
) {
    val id: String get() = slug

    /** 对齐 lib/works.ts 的 toWork：body 由 bodyMarkdown 兜底为空串。 */
    constructor(row: WorkPublicRow) : this(
        body = row.snapshot.bodyMarkdown ?: "",
        currentFocus = row.snapshot.currentFocus,
        order = row.displayOrder,
        period = row.snapshot.period,
        publishedAt = row.publishedAt,
        records = row.snapshot.records,
        repo = row.snapshot.repo,
        role = row.snapshot.role,
        shots = row.snapshot.shots,
        slug = row.snapshot.slug,
        sourceObservedAt = row.snapshot.sourceObservedAt,
        stack = row.snapshot.stack,
        status = row.snapshot.status,
        summary = row.snapshot.summary,
        title = row.snapshot.title,
        url = row.snapshot.url,
    )
}
