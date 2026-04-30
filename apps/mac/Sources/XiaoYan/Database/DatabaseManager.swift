import Foundation
import GRDB

final class DatabaseManager {
    static let shared = DatabaseManager()

    private(set) var dbQueue: DatabaseQueue!

    private init() {}

    func setup() {
        let url = AppConstants.databaseURL
        try? FileManager.default.createDirectory(at: AppConstants.appSupportURL, withIntermediateDirectories: true)

        var config = Configuration()
        config.prepareDatabase { db in
            try db.execute(sql: "PRAGMA journal_mode=WAL")
            try db.execute(sql: "PRAGMA foreign_keys=ON")
        }

        dbQueue = try! DatabaseQueue(path: url.path, configuration: config)
        try! migrate()
    }

    private func migrate() throws {
        var migrator = DatabaseMigrator()
        migrator.registerMigration("v1_initial") { db in
            // Settings
            try db.create(table: "settings") { t in
                t.column("key", .text).primaryKey()
                t.column("value", .text).notNull()
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "settings_history") { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull()
                t.column("settings_json", .text).notNull()
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Papers
            try db.create(table: "papers") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("authors", .text).notNull().defaults(sql: "'[]'")
                t.column("abstract", .text)
                t.column("year", .integer)
                t.column("venue", .text)
                t.column("doi", .text)
                t.column("file_path", .text)
                t.column("full_text", .text)
                t.column("research_interest_id", .text).references("research_interests", onDelete: .setNull)
                t.column("tags", .text).defaults(sql: "'[]'")
                t.column("importance_color", .text)
                t.column("notes", .text)
                t.column("status", .text).notNull().defaults(sql: "'uploaded'")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime)
            }

            try db.create(table: "paper_chunks") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("chunk_index", .integer).notNull()
                t.column("content", .text).notNull()
                t.column("embedding", .text)
                t.column("token_count", .integer)
            }

            try db.create(table: "paper_analyses") { t in
                t.column("paper_id", .text).primaryKey().references("papers", onDelete: .cascade)
                t.column("research_question", .text)
                t.column("core_method", .text)
                t.column("experiment_design", .text)
                t.column("experiment_results", .text)
                t.column("innovations", .text)
                t.column("limitations", .text)
                t.column("key_conclusions", .text)
                t.column("raw_analysis", .text)
            }

            try db.create(table: "reproduction_guides") { t in
                t.column("paper_id", .text).primaryKey().references("papers", onDelete: .cascade)
                t.column("code_repository", .text)
                t.column("environment_setup", .text)
                t.column("dependencies", .text)
                t.column("data_requirements", .text)
                t.column("reproduction_steps", .text)
                t.column("expected_results", .text)
                t.column("common_pitfalls", .text)
                t.column("notes", .text)
            }

            try db.create(table: "paper_figures") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("fig_index", .integer).notNull()
                t.column("caption", .text)
                t.column("file_path", .text)
            }

            // Research interests
            try db.create(table: "research_interests") { t in
                t.column("id", .text).primaryKey()
                t.column("topic", .text).notNull()
                t.column("folder_name", .text)
                t.column("keywords", .text)
                t.column("profile", .text)
                t.column("learning_path", .text)
                t.column("status", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Knowledge notes
            try db.create(table: "knowledge_notes") { t in
                t.column("id", .text).primaryKey()
                t.column("research_interest_id", .text).references("research_interests", onDelete: .setNull)
                t.column("title", .text).notNull()
                t.column("content", .text).notNull()
                t.column("source_type", .text)
                t.column("source_id", .text)
                t.column("tags", .text)
                t.column("embedding", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime)
            }

            // Chat
            try db.create(table: "chat_sessions") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text)
                t.column("context_type", .text)
                t.column("context_id", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "chat_messages") { t in
                t.column("id", .text).primaryKey()
                t.column("session_id", .text).notNull().references("chat_sessions", onDelete: .cascade)
                t.column("role", .text).notNull()
                t.column("content", .text).notNull()
                t.column("sources", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "agent_runs") { t in
                t.column("id", .text).primaryKey()
                t.column("session_id", .text).notNull().references("chat_sessions", onDelete: .cascade)
                t.column("request_id", .text).notNull()
                t.column("parent_run_id", .text).references("agent_runs", onDelete: .setNull)
                t.column("agent_name", .text).notNull()
                t.column("step_name", .text)
                t.column("status", .text).notNull().defaults(sql: "'pending'")
                t.column("order_index", .integer)
                t.column("input_payload", .text)
                t.column("output_payload", .text)
                t.column("summary", .text)
                t.column("error", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "agent_artifacts") { t in
                t.column("id", .text).primaryKey()
                t.column("run_id", .text).notNull().references("agent_runs", onDelete: .cascade)
                t.column("artifact_type", .text).notNull()
                t.column("title", .text)
                t.column("content", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Memory
            try db.create(table: "user_memories") { t in
                t.column("id", .text).primaryKey()
                t.column("type", .text).notNull()
                t.column("action", .text)
                t.column("summary", .text).notNull()
                t.column("detail", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "memory_events") { t in
                t.column("id", .text).primaryKey()
                t.column("session_id", .text).references("chat_sessions", onDelete: .setNull)
                t.column("run_id", .text).references("agent_runs", onDelete: .setNull)
                t.column("event_type", .text).notNull()
                t.column("source", .text)
                t.column("summary", .text)
                t.column("payload_json", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "memory_observations") { t in
                t.column("id", .text).primaryKey()
                t.column("event_id", .text).notNull().unique().references("memory_events", onDelete: .cascade)
                t.column("session_id", .text).references("chat_sessions", onDelete: .setNull)
                t.column("run_id", .text).references("agent_runs", onDelete: .setNull)
                t.column("source", .text)
                t.column("event_type", .text)
                t.column("title", .text)
                t.column("summary", .text)
                t.column("narrative", .text)
                t.column("importance", .integer).notNull().defaults(sql: "1")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Submission
            try db.create(table: "venues") { t in
                t.column("id", .text).primaryKey()
                t.column("type", .text).notNull()
                t.column("name", .text).notNull()
                t.column("full_name", .text)
                t.column("website", .text)
                t.column("ccf", .text)
                t.column("area", .text)
                t.column("starred", .boolean).defaults(sql: "0")
                t.column("ei", .boolean)
                t.column("sci", .boolean)
                t.column("sci_quartile", .text)
                t.column("deadline", .datetime)
                t.column("notification_date", .datetime)
                t.column("special_issue_title", .text)
                t.column("special_issue_deadline", .datetime)
                t.column("special_issue_description", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "submissions") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("venue_name", .text)
                t.column("venue_type", .text)
                t.column("status", .text)
                t.column("deadline", .datetime)
                t.column("submitted_at", .datetime)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "paper_versions") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("tag", .text)
                t.column("label", .text)
                t.column("stage", .text)
                t.column("content", .text)
                t.column("notes", .text)
                t.column("file_path", .text)
                t.column("file_name", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "review_rounds") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("round", .integer).notNull()
                t.column("verdict", .text)
                t.column("received_at", .datetime)
                t.uniqueKey(["submission_id", "round"])
            }

            try db.create(table: "review_comments") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("round", .integer).notNull()
                t.column("reviewer", .text)
                t.column("content", .text).notNull()
                t.column("response", .text)
                t.column("resolved", .boolean).defaults(sql: "0")
                t.column("tags", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "submission_checklist") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("label", .text).notNull()
                t.column("checked", .boolean).defaults(sql: "0")
                t.column("category", .text)
                t.column("sort_order", .integer).defaults(sql: "0")
            }

            // Experiment
            try db.create(table: "experiment_records") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("config", .text)
                t.column("result", .text)
                t.column("notes", .text)
                t.column("linked_submission_id", .text).references("submissions", onDelete: .setNull)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime)
            }

            try db.create(table: "experiment_attachments") { t in
                t.column("id", .text).primaryKey()
                t.column("experiment_id", .text).notNull().references("experiment_records", onDelete: .cascade)
                t.column("file_path", .text).notNull()
                t.column("label", .text)
            }

            // Knowledge graph
            try db.create(table: "knowledge_graph_claims") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("statement", .text).notNull()
                t.column("research_interest_id", .text).references("research_interests", onDelete: .setNull)
                t.column("status", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "knowledge_graph_evidence_links") { t in
                t.column("id", .text).primaryKey()
                t.column("claim_id", .text).notNull().references("knowledge_graph_claims", onDelete: .cascade)
                t.column("source_kind", .text).notNull()
                t.column("source_id", .text).notNull()
                t.column("relation_kind", .text).notNull()
                t.column("evidence_summary", .text)
                t.uniqueKey(["claim_id", "source_kind", "source_id", "relation_kind"])
            }

            try db.create(table: "knowledge_paper_citations") { t in
                t.column("id", .text).primaryKey()
                t.column("citing_paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("cited_paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("context", .text)
                t.uniqueKey(["citing_paper_id", "cited_paper_id"])
            }

            // Skills
            try db.create(table: "skills") { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull().unique()
                t.column("title", .text).notNull()
                t.column("description", .text)
                t.column("prompt", .text).notNull()
                t.column("tags", .text)
                t.column("is_builtin", .boolean).defaults(sql: "0")
                t.column("is_enabled", .boolean).defaults(sql: "1")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }
        }

        try migrator.migrate(dbQueue)
    }
}
