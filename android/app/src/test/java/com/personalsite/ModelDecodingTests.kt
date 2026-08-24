package com.personalsite

import com.personalsite.models.AiNewsPublicRow
import com.personalsite.models.AiNewsListItem
import com.personalsite.models.AskScope
import com.personalsite.models.AskSource
import com.personalsite.models.CurationItem
import com.personalsite.models.CurationMediaType
import com.personalsite.models.CurationPage
import com.personalsite.models.OpenSourceCategory
import com.personalsite.models.OpenSourceEntry
import com.personalsite.models.OpenSourceListEntry
import com.personalsite.models.OpenSourceReadingSource
import com.personalsite.models.OpenSourceStatus
import com.personalsite.models.Work
import com.personalsite.models.WorkEvidenceKind
import com.personalsite.models.WorkPublicRow
import com.personalsite.models.WorkRecordKind
import kotlinx.serialization.json.Json
import kotlinx.serialization.decodeFromString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 各模型 decode：fixture 按 TS 类型与 Supabase 迁移里的行形状手写。
 * 重点覆盖 null 字段与「外层 snake_case 列 + jsonb 内 camelCase」的分层解码。
 */
class ModelDecodingTests {
    private val json = Json { ignoreUnknownKeys = true }

    private inline fun <reified T> decode(raw: String): T = json.decodeFromString(raw)

    // MARK: AI 动态

    @Test
    fun `aiNews表行分层解码`() {
        // 外层列名 snake_case（published_at），content jsonb 内 camelCase（publishedAt）。
        // 若对整行一把梭 snake_case 命名策略，content 里的 camelCase 键会被破坏，这里反向验证。
        val row = decode<AiNewsPublicRow>(
            """
            {
              "id": "news-1",
              "content": {
                "category": "ai-models",
                "id": "news-1",
                "publishedAt": "2026-08-20T16:00:00Z",
                "reason": "值得关注",
                "score": null,
                "sourceName": "Example",
                "summary": "摘要",
                "title": "标题",
                "url": "https://example.com/a"
              },
              "selected": true,
              "published_at": "2026-08-20T16:00:00+00:00"
            }
            """.trimIndent()
        )
        assertEquals("2026-08-20T16:00:00+00:00", row.publishedAt)
        val item = row.item
        assertEquals("news-1", item.id)
        assertTrue(item.selected)
        assertNull(item.score)
        assertEquals("2026-08-20T16:00:00Z", item.publishedAt)
    }

    @Test
    fun `aiNews列表项空发布时间`() {
        val item = decode<AiNewsListItem>(
            """
            {
              "category": "tip",
              "id": "news-2",
              "publishedAt": null,
              "selected": false,
              "sourceName": "Example",
              "summary": "摘要",
              "title": "标题"
            }
            """.trimIndent()
        )
        assertNull(item.publishedAt)
    }

    // MARK: 策展

    @Test
    fun `策展分页响应解码`() {
        val page = decode<CurationPage>(
            """
            {
              "hasMore": true,
              "items": [
                {
                  "author": { "handle": "someone", "name": "某人" },
                  "attachments": ["video"],
                  "collectedAt": null,
                  "id": "cur-1",
                  "publishedAt": "2026-08-10T03:00:00Z",
                  "source": {"label":"X 原文","platform":"x","url":"https://x.com/someone/status/1"},
                  "summary": "判断",
                  "tags": ["agent"],
                  "text": "原文摘录",
                  "title": "标题"
                }
              ]
            }
            """.trimIndent()
        )
        assertTrue(page.hasMore)
        assertEquals(listOf("video"), page.items[0].attachments)
        assertNull(page.items[0].collectedAt)
    }

    @Test
    fun `策展详情媒体与引用上下文`() {
        val item = decode<CurationItem>(
            """
            {
              "analysis": "分析",
              "author": { "handle": "someone", "name": "某人" },
              "collectedAt": "2026-08-12T00:00:00Z",
              "collectedOrder": 3,
              "id": "cur-1",
              "links": [{ "shortUrl": null, "type": "article", "url": "https://example.com" }],
              "media": [
                {
                  "durationMs": null,
                  "height": 680,
                  "previewUrl": null,
                  "type": "animated_gif",
                  "url": "https://pbs.twimg.com/tweet_video_thumb/x.jpg",
                  "videoUrl": "https://video.twimg.com/tweet_video/x.mp4",
                  "width": 1200
                }
              ],
              "publishedAt": null,
              "quoteContext": null,
              "summary": "判断",
              "tags": [],
              "text": "原文",
              "title": "标题",
              "source": {"label":"X 原文","platform":"x","url":"https://x.com/someone/status/1"}
            }
            """.trimIndent()
        )
        assertEquals(CurationMediaType.ANIMATED_GIF, item.media[0].type)
        assertNull(item.media[0].durationMs)
        assertNull(item.quoteContext)
    }

    // MARK: 开源关注

    @Test
    fun `开源列表投影解码`() {
        val entry = decode<OpenSourceListEntry>(
            """
            {
              "category": "skills",
              "checkedAt": "2026-08-01",
              "dimensions": ["agent-skills", "coding-agent"],
              "repository": "org/repo",
              "slug": "repo",
              "sourceSummary": "一句话",
              "status": "持续跟踪",
              "type": "repo"
            }
            """.trimIndent()
        )
        assertEquals(OpenSourceCategory.SKILLS, entry.category)
        assertEquals("Skills 与工作流", entry.category.label)
        assertEquals(listOf("Agent Skills", "Coding Agent"), entry.dimensions.map { it.label })
        assertEquals(OpenSourceStatus.TRACKING, entry.status)
    }

    @Test
    fun `开源详情可选字段为空`() {
        val entry = decode<OpenSourceEntry>(
            """
            {
              "category": "tools",
              "caveats": [],
              "dimensions": ["ai-ingestion"],
              "evidence": {
                "checkedAt": "2026-08-01",
                "kind": "repository",
                "label": "仓库",
                "note": "看过",
                "url": "https://github.com/org/repo"
              },
              "judgement": "判断",
              "nextStep": "试用",
              "parsedMarkdown": null,
              "personalNote": "笔记",
              "repository": "org/repo",
              "repositoryDefaultBranch": null,
              "repositoryUrl": "https://github.com/org/repo",
              "readingSource": "official-zh-readme",
              "scenarios": ["场景"],
              "slug": "repo",
              "sourceSummary": "一句话",
              "status": "计划试用",
              "type": "repo",
              "workflow": [{ "description": "步骤", "label": "第一步" }]
            }
            """.trimIndent()
        )
        assertNull(entry.parsedMarkdown)
        assertNull(entry.sourceMarkdown)
        assertNull(entry.sourceTitle)
        assertEquals(OpenSourceReadingSource.OFFICIAL_ZH_README, entry.readingSource)
        assertEquals(OpenSourceStatus.PLANNED, entry.status)
    }

    // MARK: 作品档案

    @Test
    fun `works表行分层解码`() {
        // 外层 snake_case（display_order/published_at），snapshot jsonb 内 camelCase。
        val row = decode<WorkPublicRow>(
            """
            {
              "display_order": 1,
              "published_at": "2026-08-01T00:00:00+00:00",
              "snapshot": {
                "bodyMarkdown": null,
                "currentFocus": "当前重点",
                "period": "2024 — 至今",
                "projectId": "proj-1",
                "records": [
                  {
                    "bodyMarkdown": "正文",
                    "evidence": [
                      {
                        "id": "ev-1",
                        "kind": "private-verification",
                        "label": "验证记录",
                        "occurredAt": null,
                        "verifiedAt": null
                      }
                    ],
                    "id": "rec-1",
                    "kind": "milestone",
                    "occurredAt": "2026-07-01",
                    "relatedRecordIds": [],
                    "status": "已发布",
                    "summary": "摘要",
                    "title": "里程碑",
                    "topics": ["主题"],
                    "updatedAt": "2026-08-01T00:00:00Z"
                  }
                ],
                "role": "独立开发",
                "shots": [{ "label": "首页", "src": "/images/x.png" }],
                "slug": "proj",
                "sourceObservedAt": null,
                "stack": ["Swift"],
                "status": "进行中",
                "summary": "一句话",
                "title": "项目",
                "version": 1
              }
            }
            """.trimIndent()
        )
        val work = Work(row)
        assertEquals(1, work.order)
        assertEquals("2026-08-01T00:00:00+00:00", work.publishedAt)
        // bodyMarkdown 为 null 时 body 兜底空串；可选 repo/url 缺省为 null。
        assertEquals("", work.body)
        assertNull(work.repo)
        assertEquals(WorkRecordKind.MILESTONE, work.records[0].kind)
        assertEquals("项目里程碑", work.records[0].kind.label)
        assertEquals(WorkEvidenceKind.PRIVATE_VERIFICATION, work.records[0].evidence[0].kind)
        assertNull(work.records[0].evidence[0].verifiedAt)
        assertNull(work.sourceObservedAt)
    }

    // MARK: 问一问

    @Test
    fun `askSource空字段解码`() {
        val source = decode<AskSource>(
            """
            {
              "content": "摘录",
              "id": "s1",
              "publishedAt": null,
              "scope": "open-source",
              "section": null,
              "sourceId": "a1",
              "sourceUrl": "https://example.com",
              "title": "标题"
            }
            """.trimIndent()
        )
        assertEquals(AskScope.OPEN_SOURCE, source.scope)
        assertNull(source.section)
    }
}
