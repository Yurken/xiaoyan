import Foundation
import GRDB

struct SkillRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    func list() throws -> [Skill] {
        try dbQueue.read { db in
            try Skill.fetchAll(db, sql: "SELECT * FROM skills ORDER BY is_builtin DESC, created_at DESC")
        }
    }

    func get(id: String) throws -> Skill? {
        try dbQueue.read { db in
            try Skill.fetchOne(db, sql: "SELECT * FROM skills WHERE id = ?", arguments: [id])
        }
    }

    func insert(_ skill: Skill) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                INSERT INTO skills (id, name, title, description, prompt, tags, is_builtin, is_enabled, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)
                """,
                arguments: [
                    skill.id, skill.name, skill.title, skill.descriptionText, skill.prompt,
                    skill.tags?.joined(separator: ","),
                    skill.isBuiltin ?? false, skill.isEnabled ?? true,
                    skill.createdAt ?? Date()
                ]
            )
        }
    }

    func update(_ skill: Skill) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                UPDATE skills
                SET title = ?, description = ?, prompt = ?, tags = ?, is_enabled = ?
                WHERE id = ?
                """,
                arguments: [
                    skill.title, skill.descriptionText, skill.prompt,
                    skill.tags?.joined(separator: ","),
                    skill.isEnabled ?? true,
                    skill.id
                ]
            )
        }
    }

    func delete(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM skills WHERE id = ?", arguments: [id])
        }
    }

    func toggleEnabled(id: String) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE skills SET is_enabled = NOT is_enabled WHERE id = ?",
                arguments: [id]
            )
        }
    }

    func seedBuiltinsIfNeeded() throws {
        let count = try dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM skills") ?? 0
        }
        guard count == 0 else { return }
        for skill in SkillService.builtInSkills {
            try insert(skill)
        }
    }

    func resetBuiltins() throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM skills WHERE is_builtin = 1")
        }
        for skill in SkillService.builtInSkills {
            try insert(skill)
        }
    }
}
