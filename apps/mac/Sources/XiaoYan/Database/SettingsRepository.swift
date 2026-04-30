import Foundation
import GRDB

struct SettingsRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    func loadAll() throws -> [String: String] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT key, value FROM settings")
            var result: [String: String] = [:]
            for row in rows {
                result[row["key"]] = row["value"]
            }
            return result
        }
    }

    func upsert(key: String, value: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
                arguments: [key, value]
            )
        }
    }

    func upsertBatch(_ entries: [(key: String, value: String)]) throws {
        try dbQueue.write { db in
            for entry in entries {
                try db.execute(
                    sql: "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
                    arguments: [entry.key, entry.value]
                )
            }
        }
    }

    func delete(key: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM settings WHERE key = ?", arguments: [key])
        }
    }

    func saveHistory(id: String, name: String, settingsJson: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO settings_history (id, name, settings_json) VALUES (?, ?, ?)",
                arguments: [id, name, settingsJson]
            )
        }
    }

    func listHistory() throws -> [SettingsHistory] {
        try dbQueue.read { db in
            try SettingsHistory.fetchAll(db, sql: "SELECT * FROM settings_history ORDER BY created_at DESC")
        }
    }

    func getHistory(id: String) throws -> SettingsHistory? {
        try dbQueue.read { db in
            try SettingsHistory.fetchOne(db, sql: "SELECT * FROM settings_history WHERE id = ?", arguments: [id])
        }
    }

    func deleteHistory(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM settings_history WHERE id = ?", arguments: [id])
        }
    }
}
