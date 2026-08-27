import Foundation

/// 作品档案模型，对齐 lib/works-types.ts；snapshot jsonb 结构对齐 lib/works.ts 顶部的 zod schema。

struct WorkShot: Codable, Equatable, Hashable, Sendable {
    var label: String
    var src: String
}

enum WorkRecordKind: String, Codable, CaseIterable, Sendable {
    case capability
    case decision
    case experiment
    case milestone
    case practice

    /// 对齐 workRecordKindLabels。
    var label: String {
        switch self {
        case .capability: return "当前能力"
        case .decision: return "关键决策"
        case .experiment: return "实验记录"
        case .milestone: return "项目里程碑"
        case .practice: return "沉淀实践"
        }
    }
}

enum WorkEvidenceKind: String, Codable, Sendable {
    case commit
    case document
    case privateVerification = "private-verification"
}

struct WorkEvidence: Codable, Equatable, Hashable, Identifiable, Sendable {
    var id: String
    var kind: WorkEvidenceKind
    var label: String
    var occurredAt: String?
    var url: String?
    var verifiedAt: String?
}

struct WorkRecord: Codable, Equatable, Hashable, Identifiable, Sendable {
    var bodyMarkdown: String?
    var evidence: [WorkEvidence]
    var id: String
    var kind: WorkRecordKind
    var occurredAt: String?
    var relatedRecordIds: [String]
    var status: String
    var summary: String
    var title: String
    var topics: [String]
    var updatedAt: String
}

/// 站点 `/api/works` 返回的公开 SQLite 投影。
struct Work: Codable, Equatable, Hashable, Identifiable, Sendable {
    var body: String
    var currentFocus: String
    var order: Int
    var period: String
    var publishedAt: String
    var records: [WorkRecord]
    var repo: String?
    var role: String
    var shots: [WorkShot]
    var slug: String
    var sourceObservedAt: String?
    var stack: [String]
    var status: String
    var summary: String
    var title: String
    var url: String?

    var id: String { slug }

}
