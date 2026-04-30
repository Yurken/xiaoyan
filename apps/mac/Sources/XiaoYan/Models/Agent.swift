import Foundation
import GRDB

struct AgentRun: Codable, Identifiable, FetchableRecord {
    let id: String
    var sessionId: String
    var requestId: String
    var parentRunId: String?
    var agentName: String
    var stepName: String?
    var status: AgentStatus
    var orderIndex: Int?
    var inputPayload: String?
    var outputPayload: String?
    var summary: String?
    var error: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, status, summary, error
        case sessionId = "session_id"
        case requestId = "request_id"
        case parentRunId = "parent_run_id"
        case agentName = "agent_name"
        case stepName = "step_name"
        case orderIndex = "order_index"
        case inputPayload = "input_payload"
        case outputPayload = "output_payload"
        case createdAt = "created_at"
    }
}

enum AgentStatus: String, Codable {
    case idle, pending, running, done, failed
}

struct AgentArtifact: Codable, Identifiable, FetchableRecord {
    let id: String
    var runId: String
    var artifactType: String
    var title: String?
    var content: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, content
        case runId = "run_id"
        case artifactType = "artifact_type"
        case createdAt = "created_at"
    }
}

enum AgentType: String, CaseIterable {
    case retrieval, planner, literatureScout = "literature_scout"
    case survey, paperAnalyst = "paper_analyst"
    case reproduction, synthesis

    var displayName: String {
        switch self {
        case .retrieval: return "检索"
        case .planner: return "规划师"
        case .literatureScout: return "文献侦察"
        case .survey: return "综述"
        case .paperAnalyst: return "论文分析"
        case .reproduction: return "复现"
        case .synthesis: return "综合"
        }
    }
}
