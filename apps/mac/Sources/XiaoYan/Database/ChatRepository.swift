import Foundation
import GRDB

struct ChatRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    // Sessions
    func createSession(id: String, title: String?, contextType: String?, contextId: String?) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO chat_sessions (id, title, context_type, context_id) VALUES (?,?,?,?)",
                arguments: [id, title, contextType, contextId]
            )
        }
    }

    func listSessions() throws -> [ChatSession] {
        try dbQueue.read { db in
            try ChatSession.fetchAll(
                db,
                sql: "SELECT * FROM chat_sessions ORDER BY created_at DESC"
            )
        }
    }

    func deleteSession(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM chat_sessions WHERE id = ?", arguments: [id])
        }
    }

    func updateSessionTitle(id: String, title: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE chat_sessions SET title = ? WHERE id = ?",
                arguments: [title, id]
            )
        }
    }

    // Messages
    func insertMessage(_ message: ChatMessage) throws {
        try dbQueue.write { db in
            let sourcesJson = message.sources.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            try db.execute(
                sql: "INSERT INTO chat_messages (id, session_id, role, content, sources) VALUES (?,?,?,?,?)",
                arguments: [message.id, message.sessionId, message.role, message.content, sourcesJson]
            )
        }
    }

    func fetchHistory(sessionId: String, limit: Int = 10) throws -> [ChatMessage] {
        try dbQueue.read { db in
            try ChatMessage.fetchAll(
                db,
                sql: "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
                arguments: [sessionId, limit]
            )
        }
    }

    // Agent Runs
    func insertAgentRun(_ run: AgentRun) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO agent_runs (id, session_id, request_id, parent_run_id, agent_name,
                        step_name, status, order_index, input_payload, output_payload, summary, error)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                arguments: [
                    run.id, run.sessionId, run.requestId, run.parentRunId,
                    run.agentName, run.stepName, run.status.rawValue,
                    run.orderIndex, run.inputPayload, run.outputPayload,
                    run.summary, run.error
                ]
            )
        }
    }

    func updateAgentRunStatus(id: String, status: AgentStatus, summary: String?, error: String?) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE agent_runs SET status=?, summary=?, error=? WHERE id=?",
                arguments: [status.rawValue, summary, error, id]
            )
        }
    }

    func listAgentRuns(sessionId: String) throws -> [AgentRun] {
        try dbQueue.read { db in
            try AgentRun.fetchAll(
                db,
                sql: "SELECT * FROM agent_runs WHERE session_id = ? ORDER BY order_index, created_at",
                arguments: [sessionId]
            )
        }
    }

    func updateSessionContext(id: String, contextType: String?, contextId: String?) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE chat_sessions SET context_type=?, context_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                arguments: [contextType, contextId, id]
            )
        }
    }

    func insertAgentArtifact(_ artifact: AgentArtifact) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO agent_artifacts (id, run_id, artifact_type, title, content) VALUES (?,?,?,?,?)",
                arguments: [artifact.id, artifact.runId, artifact.artifactType, artifact.title, artifact.content]
            )
        }
    }
}
