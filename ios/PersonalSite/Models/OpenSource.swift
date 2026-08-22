import Foundation

/// 开源关注模型，对齐 lib/open-source-types.ts。
/// 列表/详情走 github_open_source_items 的 PostgREST 投影（select 别名后已是 camelCase），默认解码即可。

enum OpenSourceCategory: String, Codable, CaseIterable, Sendable {
    case all
    case skills
    case agents
    case context
    case tools

    var label: String {
        switch self {
        case .all: return "全部"
        case .skills: return "Skills 与工作流"
        case .agents: return "智能体系统"
        case .context: return "智能体上下文"
        case .tools: return "AI 开发工具"
        }
    }
}

enum OpenSourceDimension: String, Codable, CaseIterable, Sendable {
    case agentSkills = "agent-skills"
    case codingAgent = "coding-agent"
    case agentRuntime = "agent-runtime"
    case longRunning = "long-running"
    case multiAgent = "multi-agent"
    case agentControl = "agent-control"
    case agentInfra = "agent-infra"
    case agentContext = "agent-context"
    case localRetrieval = "local-retrieval"
    case modelGateway = "model-gateway"
    case aiIngestion = "ai-ingestion"

    var label: String {
        switch self {
        case .agentSkills: return "Agent Skills"
        case .codingAgent: return "Coding Agent"
        case .agentRuntime: return "Agent 运行时"
        case .longRunning: return "长程 Agent"
        case .multiAgent: return "多智能体协作"
        case .agentControl: return "Agent 控制面"
        case .agentInfra: return "Agent 基础设施"
        case .agentContext: return "Agent 上下文"
        case .localRetrieval: return "本地检索"
        case .modelGateway: return "模型网关"
        case .aiIngestion: return "AI 数据入口"
        }
    }
}

enum OpenSourceStatus: String, Codable, Sendable {
    case tracking = "持续跟踪"
    case planned = "计划试用"
    case distilled = "已提炼"
}

enum OpenSourceEvidenceKind: String, Codable, Sendable {
    case readme
    case repository
}

enum OpenSourceReadingSource: String, Codable, Sendable {
    case officialZhReadme = "official-zh-readme"
    case kimiTranslation = "kimi-translation"
}

struct OpenSourceEvidence: Codable, Equatable, Sendable {
    var checkedAt: String
    var kind: OpenSourceEvidenceKind
    var label: String
    var note: String
    var url: String
}

struct OpenSourceWorkflowStep: Codable, Equatable, Sendable {
    var description: String
    var label: String
}

/// content jsonb 的完整结构（camelCase）。
struct OpenSourceEntry: Codable, Equatable, Identifiable, Sendable {
    var category: OpenSourceCategory
    var caveats: [String]
    var dimensions: [OpenSourceDimension]
    var evidence: OpenSourceEvidence
    var judgement: String
    var nextStep: String
    var parsedMarkdown: String?
    var personalNote: String
    var repository: String
    var repositoryDefaultBranch: String?
    var repositoryUrl: String
    var readingSource: OpenSourceReadingSource?
    var readingSourcePath: String?
    var scenarios: [String]
    var slug: String
    var sourceMarkdown: String?
    var sourceSummary: String
    var sourceTitle: String?
    var status: OpenSourceStatus
    var type: String
    var workflow: [OpenSourceWorkflowStep]

    var id: String { slug }
}

/// 列表投影（对齐 OpenSourceListEntry）：长 Markdown 不进列表。
struct OpenSourceListEntry: Codable, Equatable, Identifiable, Sendable {
    var category: OpenSourceCategory
    var checkedAt: String
    var dimensions: [OpenSourceDimension]
    var repository: String
    var slug: String
    var sourceSummary: String
    var status: OpenSourceStatus
    var type: String

    var id: String { slug }
}

/// /api/open-source/[slug]/repository/tree 的响应。
struct RepositoryTreeResponse: Decodable, Sendable {
    var branch: String
    var entries: [RepositoryTreeEntry]
    var repository: String
    var repositoryUrl: String
    var truncated: Bool
}

struct RepositoryTreeEntry: Decodable, Equatable, Sendable {
    enum EntryType: String, Decodable, Sendable {
        case blob
        case tree
    }

    var path: String
    var size: Int?
    var type: EntryType
}

/// /api/open-source/[slug]/repository/file 的响应；binary 时 content 为 null。
struct RepositoryFileResponse: Decodable, Sendable {
    var binary: Bool
    var branch: String
    var content: String?
    var fileUrl: String
    var path: String
    var repository: String
}
