import Foundation
import GRDB

struct ChatSession: Codable, Identifiable, FetchableRecord {
    let id: String
    var title: String?
    var contextType: String?
    var contextId: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title
        case contextType = "context_type"
        case contextId = "context_id"
        case createdAt = "created_at"
    }
}

struct ChatMessage: Codable, Identifiable, FetchableRecord {
    let id: String
    let sessionId: String
    let role: String
    var content: String
    var sources: [ChatSource]?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case sessionId = "session_id"
        case role, content, sources
        case createdAt = "created_at"
    }
}

struct ChatSource: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    let title: String
    let score: Double
    var chunkIndex: Int?
    var paperId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, score
        case chunkIndex = "chunk_index"
        case paperId = "paper_id"
    }
}

// MARK: - Stream Protocol

enum ChatStreamChunk: Codable {
    case sessionId(requestId: String, sessionId: String)
    case requestId(String)
    case plan(String)
    case agentStart(runId: String, agentName: String, stepName: String)
    case agentComplete(runId: String, summary: String?)
    case agentError(runId: String, error: String)
    case delta(String)
    case sources([ChatSource])
    case error(String)
    case done

    enum CodingKeys: String, CodingKey {
        case type, requestId = "request_id", sessionId = "session_id"
        case content, runId = "run_id", agentName = "agent_name"
        case stepName = "step_name", summary, sources, error
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "session_id":
            let rid = try container.decode(String.self, forKey: .requestId)
            let sid = try container.decode(String.self, forKey: .sessionId)
            self = .sessionId(requestId: rid, sessionId: sid)
        case "request_id":
            self = .requestId(try container.decode(String.self, forKey: .content))
        case "plan":
            self = .plan(try container.decode(String.self, forKey: .content))
        case "agent_start":
            let rid = try container.decode(String.self, forKey: .runId)
            let name = try container.decode(String.self, forKey: .agentName)
            let step = try container.decode(String.self, forKey: .stepName)
            self = .agentStart(runId: rid, agentName: name, stepName: step)
        case "agent_complete":
            let rid = try container.decode(String.self, forKey: .runId)
            let summary = try container.decodeIfPresent(String.self, forKey: .summary)
            self = .agentComplete(runId: rid, summary: summary)
        case "agent_error":
            let rid = try container.decode(String.self, forKey: .runId)
            let err = try container.decode(String.self, forKey: .error)
            self = .agentError(runId: rid, error: err)
        case "delta":
            self = .delta(try container.decode(String.self, forKey: .content))
        case "sources":
            self = .sources(try container.decode([ChatSource].self, forKey: .sources))
        case "error":
            self = .error(try container.decode(String.self, forKey: .error))
        case "done":
            self = .done
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown chunk type: \(type)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .sessionId(let rid, let sid):
            try container.encode("session_id", forKey: .type)
            try container.encode(rid, forKey: .requestId)
            try container.encode(sid, forKey: .sessionId)
        case .requestId(let id):
            try container.encode("request_id", forKey: .type)
            try container.encode(id, forKey: .content)
        case .plan(let content):
            try container.encode("plan", forKey: .type)
            try container.encode(content, forKey: .content)
        case .agentStart(let rid, let name, let step):
            try container.encode("agent_start", forKey: .type)
            try container.encode(rid, forKey: .runId)
            try container.encode(name, forKey: .agentName)
            try container.encode(step, forKey: .stepName)
        case .agentComplete(let rid, let summary):
            try container.encode("agent_complete", forKey: .type)
            try container.encode(rid, forKey: .runId)
            try container.encode(summary, forKey: .summary)
        case .agentError(let rid, let error):
            try container.encode("agent_error", forKey: .type)
            try container.encode(rid, forKey: .runId)
            try container.encode(error, forKey: .error)
        case .delta(let content):
            try container.encode("delta", forKey: .type)
            try container.encode(content, forKey: .content)
        case .sources(let sources):
            try container.encode("sources", forKey: .type)
            try container.encode(sources, forKey: .sources)
        case .error(let error):
            try container.encode("error", forKey: .type)
            try container.encode(error, forKey: .error)
        case .done:
            try container.encode("done", forKey: .type)
        }
    }
}
