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

            // Research interests
            try db.create(table: "research_interests") { t in
                t.column("id", .text).primaryKey()
                t.column("topic", .text).notNull()
                t.column("folder_name", .text)
                t.column("keywords", .text).notNull().defaults(sql: "'[]'")
                t.column("profile", .text)
                t.column("learning_path", .text)
                t.column("status", .text).notNull().defaults(sql: "'active'")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Knowledge notes
            try db.create(table: "knowledge_notes") { t in
                t.column("id", .text).primaryKey()
                t.column("research_interest_id", .text).references("research_interests", onDelete: .setNull)
                t.column("title", .text).notNull()
                t.column("content", .text).notNull()
                t.column("source_type", .text).notNull().defaults(sql: "'manual'")
                t.column("source_id", .text)
                t.column("tags", .text).notNull().defaults(sql: "'[]'")
                t.column("embedding", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
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
                t.column("tags", .text).notNull().defaults(sql: "'[]'")
                t.column("importance_color", .text).notNull().defaults(sql: "''")
                t.column("notes", .text)
                t.column("status", .text).notNull().defaults(sql: "'uploaded'")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "paper_chunks") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("chunk_index", .integer).notNull()
                t.column("content", .text).notNull()
                t.column("embedding", .text)
                t.column("token_count", .integer)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "paper_analyses") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().unique().references("papers", onDelete: .cascade)
                t.column("research_question", .text)
                t.column("core_method", .text)
                t.column("experiment_design", .text)
                t.column("experiment_results", .text)
                t.column("innovations", .text)
                t.column("limitations", .text)
                t.column("key_conclusions", .text)
                t.column("raw_analysis", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "reproduction_guides") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().unique().references("papers", onDelete: .cascade)
                t.column("code_repository", .text)
                t.column("environment_setup", .text)
                t.column("dependencies", .text)
                t.column("data_requirements", .text)
                t.column("reproduction_steps", .text)
                t.column("expected_results", .text)
                t.column("common_pitfalls", .text)
                t.column("notes", .text)
                t.column("dataset_preparation", .text)
                t.column("training_process", .text)
                t.column("inference_process", .text)
                t.column("evaluation_metrics", .text)
                t.column("risks_and_notes", .text)
                t.column("raw_guide", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "paper_figures") { t in
                t.column("id", .text).primaryKey()
                t.column("paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("fig_index", .integer).notNull()
                t.column("caption", .text)
                t.column("file_path", .text).notNull()
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Chat
            try db.create(table: "chat_sessions") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull().defaults(sql: "'New Conversation'")
                t.column("context_type", .text).notNull().defaults(sql: "'general'")
                t.column("context_id", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
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
                t.column("step_name", .text).notNull().defaults(sql: "''")
                t.column("status", .text).notNull().defaults(sql: "'pending'")
                t.column("order_index", .integer).notNull().defaults(sql: "0")
                t.column("input_payload", .text)
                t.column("output_payload", .text)
                t.column("summary", .text)
                t.column("error", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "agent_artifacts") { t in
                t.column("id", .text).primaryKey()
                t.column("run_id", .text).notNull().references("agent_runs", onDelete: .cascade)
                t.column("artifact_type", .text).notNull()
                t.column("title", .text).notNull().defaults(sql: "''")
                t.column("content", .text).notNull().defaults(sql: "''")
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
                t.column("full_name", .text).notNull().defaults(sql: "''")
                t.column("website", .text).notNull().defaults(sql: "''")
                t.column("ccf", .text).notNull().defaults(sql: "''")
                t.column("area", .text).notNull().defaults(sql: "''")
                t.column("starred", .boolean).notNull().defaults(sql: "0")
                t.column("ei", .boolean)
                t.column("sci", .boolean)
                t.column("sci_quartile", .text).notNull().defaults(sql: "''")
                t.column("deadline", .datetime)
                t.column("notification_date", .datetime)
                t.column("special_issue_title", .text).notNull().defaults(sql: "''")
                t.column("special_issue_deadline", .datetime)
                t.column("special_issue_description", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "submissions") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("venue_name", .text).notNull().defaults(sql: "''")
                t.column("venue_type", .text).notNull().defaults(sql: "'conference'")
                t.column("status", .text).notNull().defaults(sql: "'writing'")
                t.column("deadline", .datetime)
                t.column("submitted_at", .datetime)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "paper_versions") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("tag", .text).notNull().defaults(sql: "''")
                t.column("label", .text).notNull().defaults(sql: "''")
                t.column("stage", .text).notNull().defaults(sql: "''")
                t.column("content", .text).notNull().defaults(sql: "''")
                t.column("notes", .text).notNull().defaults(sql: "''")
                t.column("file_path", .text)
                t.column("file_name", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "review_rounds") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("round", .integer).notNull()
                t.column("verdict", .text).notNull().defaults(sql: "'pending'")
                t.column("received_at", .datetime)
                t.uniqueKey(["submission_id", "round"])
            }

            try db.create(table: "review_comments") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("round", .integer).notNull()
                t.column("reviewer", .text).notNull().defaults(sql: "''")
                t.column("content", .text).notNull()
                t.column("response", .text).notNull().defaults(sql: "''")
                t.column("resolved", .boolean).notNull().defaults(sql: "0")
                t.column("tags", .text).notNull().defaults(sql: "'[]'")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "submission_checklist") { t in
                t.column("id", .text).primaryKey()
                t.column("submission_id", .text).notNull().references("submissions", onDelete: .cascade)
                t.column("label", .text).notNull()
                t.column("checked", .boolean).notNull().defaults(sql: "0")
                t.column("category", .text).notNull().defaults(sql: "''")
                t.column("sort_order", .integer).notNull().defaults(sql: "0")
            }

            // Experiment
            try db.create(table: "experiment_records") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("config", .text).notNull().defaults(sql: "'{}'")
                t.column("result", .text).notNull().defaults(sql: "''")
                t.column("notes", .text).notNull().defaults(sql: "''")
                t.column("linked_submission_id", .text).references("submissions", onDelete: .setNull)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "experiment_attachments") { t in
                t.column("id", .text).primaryKey()
                t.column("experiment_id", .text).notNull().references("experiment_records", onDelete: .cascade)
                t.column("file_path", .text).notNull()
                t.column("label", .text).notNull().defaults(sql: "''")
            }

            // Knowledge graph
            try db.create(table: "knowledge_graph_claims") { t in
                t.column("id", .text).primaryKey()
                t.column("title", .text).notNull()
                t.column("statement", .text).notNull().defaults(sql: "''")
                t.column("research_interest_id", .text).references("research_interests", onDelete: .setNull)
                t.column("status", .text).notNull().defaults(sql: "'supported'")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            try db.create(table: "knowledge_graph_evidence_links") { t in
                t.column("id", .text).primaryKey()
                t.column("claim_id", .text).notNull().references("knowledge_graph_claims", onDelete: .cascade)
                t.column("source_kind", .text).notNull()
                t.column("source_id", .text).notNull()
                t.column("relation_kind", .text).notNull()
                t.column("evidence_summary", .text).notNull().defaults(sql: "''")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.uniqueKey(["claim_id", "source_kind", "source_id", "relation_kind"])
            }

            try db.create(table: "knowledge_paper_citations") { t in
                t.column("id", .text).primaryKey()
                t.column("citing_paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("cited_paper_id", .text).notNull().references("papers", onDelete: .cascade)
                t.column("context", .text)
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.uniqueKey(["citing_paper_id", "cited_paper_id"])
            }

            // Skills
            try db.create(table: "skills") { t in
                t.column("id", .text).primaryKey()
                t.column("name", .text).notNull().unique()
                t.column("title", .text).notNull()
                t.column("description", .text).notNull().defaults(sql: "''")
                t.column("prompt", .text).notNull().defaults(sql: "''")
                t.column("tags", .text).notNull().defaults(sql: "'[]'")
                t.column("is_builtin", .boolean).notNull().defaults(sql: "0")
                t.column("is_enabled", .boolean).notNull().defaults(sql: "1")
                t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                t.column("updated_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
            }

            // Indexes
            try db.create(index: "idx_settings_history_created_at", on: "settings_history", columns: ["created_at"])
            try db.create(index: "idx_papers_created_at", on: "papers", columns: ["created_at"])
            try db.create(index: "idx_papers_status", on: "papers", columns: ["status"])
            try db.create(index: "idx_papers_research_interest_created_at", on: "papers", columns: ["research_interest_id", "created_at"])
            try db.create(index: "idx_paper_chunks_paper_id_chunk_index", on: "paper_chunks", columns: ["paper_id", "chunk_index"])
            try db.create(index: "idx_paper_figures_paper_id_fig_index", on: "paper_figures", columns: ["paper_id", "fig_index"])
            try db.create(index: "idx_user_memories_type_created", on: "user_memories", columns: ["type", "created_at"])
            try db.create(index: "idx_memory_events_source_created", on: "memory_events", columns: ["source", "created_at"])
            try db.create(index: "idx_memory_events_session_created", on: "memory_events", columns: ["session_id", "created_at"])
            try db.create(index: "idx_memory_observations_created", on: "memory_observations", columns: ["created_at"])
            try db.create(index: "idx_memory_observations_source_created", on: "memory_observations", columns: ["source", "created_at"])
            try db.create(index: "idx_memory_observations_session_created", on: "memory_observations", columns: ["session_id", "created_at"])
        }

        migrator.registerMigration("v2_schema_align") { db in
            // Rebuild paper_analyses if it still uses paper_id as PK (pre-v1-fix installations)
            let columnNames = try String.fetchAll(db, sql: "SELECT name FROM pragma_table_info('paper_analyses')")
            if !columnNames.contains("id") {
                try db.create(table: "paper_analyses_new") { t in
                    t.column("id", .text).primaryKey()
                    t.column("paper_id", .text).notNull().unique().references("papers", onDelete: .cascade)
                    t.column("research_question", .text)
                    t.column("core_method", .text)
                    t.column("experiment_design", .text)
                    t.column("experiment_results", .text)
                    t.column("innovations", .text)
                    t.column("limitations", .text)
                    t.column("key_conclusions", .text)
                    t.column("raw_analysis", .text)
                    t.column("created_at", .datetime).notNull().defaults(sql: "CURRENT_TIMESTAMP")
                }
                try db.execute(sql: """
                    INSERT INTO paper_analyses_new (id, paper_id, research_question, core_method, experiment_design, experiment_results, innovations, limitations, key_conclusions, raw_analysis, created_at)
                    SELECT lower(hex(randomblob(16))), paper_id, research_question, core_method, experiment_design, NULL, innovations, limitations, key_conclusions, raw_analysis, CURRENT_TIMESTAMP
                    FROM paper_analyses
                    """)
                try db.drop(table: "paper_analyses")
                try db.rename(table: "paper_analyses_new", to: "paper_analyses")
            }

            // Add missing columns (ignore errors if column already exists)
            let addColumns = [
                "ALTER TABLE chat_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE agent_runs ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE skills ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE submissions ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE experiment_records ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE knowledge_graph_claims ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE knowledge_paper_citations ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE paper_chunks ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE reproduction_guides ADD COLUMN dataset_preparation TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN training_process TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN inference_process TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN evaluation_metrics TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN risks_and_notes TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN raw_guide TEXT",
                "ALTER TABLE reproduction_guides ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE paper_analyses ADD COLUMN experiment_results TEXT",
                "ALTER TABLE paper_analyses ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "ALTER TABLE knowledge_graph_evidence_links ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP",
            ]
            for sql in addColumns {
                try? db.execute(sql: sql)
            }

            // Add missing indexes
            let indexes = [
                "CREATE INDEX IF NOT EXISTS idx_settings_history_created_at ON settings_history(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status)",
                "CREATE INDEX IF NOT EXISTS idx_papers_research_interest_created_at ON papers(research_interest_id, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id_chunk_index ON paper_chunks(paper_id, chunk_index)",
                "CREATE INDEX IF NOT EXISTS idx_paper_figures_paper_id_fig_index ON paper_figures(paper_id, fig_index)",
                "CREATE INDEX IF NOT EXISTS idx_user_memories_type_created ON user_memories(type, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_memory_events_source_created ON memory_events(source, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_memory_events_session_created ON memory_events(session_id, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_memory_observations_created ON memory_observations(created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_memory_observations_source_created ON memory_observations(source, created_at DESC)",
                "CREATE INDEX IF NOT EXISTS idx_memory_observations_session_created ON memory_observations(session_id, created_at DESC)",
            ]
            for sql in indexes {
                try db.execute(sql: sql)
            }
        }

        try migrator.migrate(dbQueue)
    }
}
