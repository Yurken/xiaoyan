import Foundation
import GRDB

struct ExperimentRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    func list() throws -> [ExperimentRecord] {
        try dbQueue.read { db in
            try ExperimentRecord.fetchAll(db, sql: "SELECT * FROM experiment_records ORDER BY created_at DESC")
        }
    }

    func get(id: String) throws -> ExperimentRecord? {
        try dbQueue.read { db in
            try ExperimentRecord.fetchOne(db, sql: "SELECT * FROM experiment_records WHERE id = ?", arguments: [id])
        }
    }

    func insert(_ record: ExperimentRecord) throws {
        try dbQueue.write { db in
            let configJson = record.config.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            let resultJson = record.result.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            try db.execute(
                sql: "INSERT INTO experiment_records (id, title, config, result, notes, linked_submission_id) VALUES (?,?,?,?,?,?)",
                arguments: [record.id, record.title, configJson, resultJson, record.notes, record.linkedSubmissionId]
            )
        }
    }

    func update(_ record: ExperimentRecord) throws {
        try dbQueue.write { db in
            let configJson = record.config.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            let resultJson = record.result.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            try db.execute(
                sql: "UPDATE experiment_records SET title=?, config=?, result=?, notes=?, linked_submission_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                arguments: [record.title, configJson, resultJson, record.notes, record.linkedSubmissionId, record.id]
            )
        }
    }

    func delete(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM experiment_records WHERE id = ?", arguments: [id])
        }
    }

    // Attachments
    func listAttachments(experimentId: String) throws -> [ExperimentAttachment] {
        try dbQueue.read { db in
            try ExperimentAttachment.fetchAll(
                db,
                sql: "SELECT * FROM experiment_attachments WHERE experiment_id = ?",
                arguments: [experimentId]
            )
        }
    }

    func insertAttachment(_ attachment: ExperimentAttachment) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO experiment_attachments (id, experiment_id, file_path, label) VALUES (?,?,?,?)",
                arguments: [attachment.id, attachment.experimentId, attachment.filePath, attachment.label]
            )
        }
    }

    func updateAttachmentLabel(id: String, label: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE experiment_attachments SET label = ? WHERE id = ?",
                arguments: [label, id]
            )
        }
    }

    func deleteAttachment(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM experiment_attachments WHERE id = ?", arguments: [id])
        }
    }
}
