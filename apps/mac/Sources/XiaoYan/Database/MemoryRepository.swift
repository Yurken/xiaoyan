import Foundation
import GRDB

struct MemoryRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    // User Memories
    func listMemories() throws -> [UserMemory] {
        try dbQueue.read { db in
            try UserMemory.fetchAll(db, sql: "SELECT * FROM user_memories ORDER BY created_at DESC")
        }
    }

    func insertMemory(_ memory: UserMemory) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO user_memories (id, type, action, summary, detail) VALUES (?,?,?,?,?)",
                arguments: [memory.id, memory.type, memory.action, memory.summary, memory.detail]
            )
        }
    }

    func deleteMemory(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM user_memories WHERE id = ?", arguments: [id])
        }
    }

    // Memory Events
    func insertEvent(_ event: MemoryEvent) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO memory_events (id, session_id, run_id, event_type, source, summary, payload_json) VALUES (?,?,?,?,?,?,?)",
                arguments: [
                    event.id, event.sessionId, event.runId,
                    event.eventType, event.source, event.summary, event.payloadJson
                ]
            )
        }
    }

    // Memory Observations
    func insertObservation(_ obs: MemoryObservation) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO memory_observations (id, event_id, session_id, run_id, source, event_type, title, summary, narrative, importance) VALUES (?,?,?,?,?,?,?,?,?,?)",
                arguments: [
                    obs.id, obs.eventId, obs.sessionId, obs.runId,
                    obs.source, obs.eventType, obs.title, obs.summary, obs.narrative, obs.importance
                ]
            )
        }
    }

    func searchObservations(query: String, limit: Int = 20) throws -> [MemoryObservation] {
        try dbQueue.read { db in
            try MemoryObservation.fetchAll(
                db,
                sql: "SELECT * FROM memory_observations WHERE title LIKE ? OR summary LIKE ? OR narrative LIKE ? ORDER BY importance DESC, created_at DESC LIMIT ?",
                arguments: ["%\(query)%", "%\(query)%", "%\(query)%", limit]
            )
        }
    }

    func recentObservations(hours: Int = 3, limit: Int = 20) throws -> [MemoryObservation] {
        try dbQueue.read { db in
            try MemoryObservation.fetchAll(
                db,
                sql: "SELECT * FROM memory_observations WHERE created_at > datetime('now', '-\(hours) hours') ORDER BY created_at DESC LIMIT ?",
                arguments: [limit]
            )
        }
    }

    func pruneObservations(keepLatest: Int = 1000) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM memory_observations WHERE id NOT IN (SELECT id FROM memory_observations ORDER BY created_at DESC LIMIT ?)",
                arguments: [keepLatest]
            )
        }
    }
}
