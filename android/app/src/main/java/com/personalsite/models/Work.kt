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

/** 站点 `/api/works` 返回的公开 SQLite 投影。 */
@Serializable
data class Work(
    val body: String,
    val currentFocus: String,
    val order: Int,
    val period: String,
    val publishedAt: String,
    val records: List<WorkRecord>,
    val repo: String? = null,
    val role: String,
    val shots: List<WorkShot>,
    val slug: String,
    val sourceObservedAt: String? = null,
    val stack: List<String>,
    val status: String,
    val summary: String,
    val title: String,
    val url: String? = null,
) {
    val id: String get() = slug
}
