import Foundation
import GRDB

struct UserMemory: Codable, Identifiable, FetchableRecord {
    let id: String
    var type: String
    var action: String?
    var summary: String
    var detail: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, type, action, summary, detail
        case createdAt = "created_at"
    }
}

struct MemoryEvent: Codable, Identifiable, FetchableRecord {
    let id: String
    var sessionId: String?
    var runId: String?
    var eventType: String
    var source: String?
    var summary: String?
    var payloadJson: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, summary
        case sessionId = "session_id"
        case runId = "run_id"
        case eventType = "event_type"
        case source
        case payloadJson = "payload_json"
        case createdAt = "created_at"
    }
}

struct MemoryObservation: Codable, Identifiable, FetchableRecord {
    let id: String
    var eventId: String
    var sessionId: String?
    var runId: String?
    var source: String?
    var eventType: String?
    var title: String?
    var summary: String?
    var narrative: String?
    var importance: Int
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, summary, narrative, importance, source
        case eventId = "event_id"
        case sessionId = "session_id"
        case runId = "run_id"
        case eventType = "event_type"
        case createdAt = "created_at"
    }
}
