import Foundation
import Testing

@testable import PersonalSite

/// 各模型 decode：fixture 按 TS 类型与 Supabase 迁移里的行形状手写。
/// 重点覆盖 null 字段与「外层 snake_case 列 + jsonb 内 camelCase」的分层解码。
struct ModelDecodingTests {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try JSONDecoder().decode(type, from: Data(json.utf8))
    }

    // MARK: AI 动态

    @Test func aiNews表行分层解码() throws {
        // 外层列名 snake_case（published_at），content jsonb 内 camelCase（publishedAt）。
        // 若对整行一把梭 convertFromSnakeCase，content 里的 camelCase 键会被破坏，这里反向验证。
        let row = try decode(AiNewsPublicRow.self, """
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
        """)
        #expect(row.publishedAt == "2026-08-20T16:00:00+00:00")
        let item = row.item
        #expect(item.id == "news-1")
        #expect(item.selected)
        #expect(item.score == nil)
        #expect(item.publishedAt == "2026-08-20T16:00:00Z")
    }

    @Test func aiNews列表项空发布时间() throws {
        let item = try decode(AiNewsListItem.self, """
        {
          "category": "tip",
          "id": "news-2",
          "publishedAt": null,
          "selected": false,
          "sourceName": "Example",
          "summary": "摘要",
          "title": "标题"
        }
        """)
        #expect(item.publishedAt == nil)
    }

    // MARK: 策展

    @Test func 策展分页响应解码() throws {
        let page = try decode(CurationPage.self, """
        {
          "hasMore": true,
          "items": [
            {
              "author": { "handle": "someone", "name": "某人" },
              "attachments": ["video"],
              "collectedAt": null,
              "id": "cur-1",
              "publishedAt": "2026-08-10T03:00:00Z",
              "summary": "判断",
              "tags": ["agent"],
              "text": "原文摘录",
              "title": "标题"
            }
          ]
        }
        """)
        #expect(page.hasMore)
        #expect(page.items[0].attachments == ["video"])
        #expect(page.items[0].collectedAt == nil)
    }

    @Test func 策展详情媒体与引用上下文() throws {
        let item = try decode(CurationItem.self, """
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
          "tweetUrl": "https://x.com/someone/status/1"
        }
        """)
        #expect(item.media[0].type == .animatedGif)
        #expect(item.media[0].durationMs == nil)
        #expect(item.quoteContext == nil)
    }

    // MARK: 开源关注

    @Test func 开源列表投影解码() throws {
        let entry = try decode(OpenSourceListEntry.self, """
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
        """)
        #expect(entry.category == .skills)
        #expect(entry.category.label == "Skills 与工作流")
        #expect(entry.dimensions.map(\.label) == ["Agent Skills", "Coding Agent"])
        #expect(entry.status == .tracking)
    }

    @Test func 开源详情可选字段为空() throws {
        let entry = try decode(OpenSourceEntry.self, """
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
        """)
        #expect(entry.parsedMarkdown == nil)
        #expect(entry.sourceMarkdown == nil)
        #expect(entry.sourceTitle == nil)
        #expect(entry.readingSource == .officialZhReadme)
        #expect(entry.status == .planned)
    }

    // MARK: 作品档案

    @Test func works表行分层解码() throws {
        // 外层 snake_case（display_order/published_at），snapshot jsonb 内 camelCase。
        let row = try decode(WorkPublicRow.self, """
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
        """)
        let work = Work(row: row)
        #expect(work.order == 1)
        #expect(work.publishedAt == "2026-08-01T00:00:00+00:00")
        // bodyMarkdown 为 null 时 body 兜底空串；可选 repo/url 缺省为 nil。
        #expect(work.body == "")
        #expect(work.repo == nil)
        #expect(work.records[0].kind == .milestone)
        #expect(work.records[0].kind.label == "项目里程碑")
        #expect(work.records[0].evidence[0].kind == .privateVerification)
        #expect(work.records[0].evidence[0].verifiedAt == nil)
        #expect(work.sourceObservedAt == nil)
    }

    // MARK: 问一问

    @Test func askSource空字段解码() throws {
        let source = try decode(AskSource.self, """
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
        """)
        #expect(source.scope == .openSource)
        #expect(source.section == nil)
    }
}
