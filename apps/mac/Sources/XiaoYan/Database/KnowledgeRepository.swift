import Foundation
import GRDB

struct KnowledgeRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    // Research Interests
    func listInterests() throws -> [ResearchInterest] {
        try dbQueue.read { db in
            try ResearchInterest.fetchAll(db, sql: "SELECT * FROM research_interests ORDER BY created_at DESC")
        }
    }

    func getInterest(id: String) throws -> ResearchInterest? {
        try dbQueue.read { db in
            try ResearchInterest.fetchOne(db, sql: "SELECT * FROM research_interests WHERE id = ?", arguments: [id])
        }
    }

    func insertInterest(_ interest: ResearchInterest) throws {
        try dbQueue.write { db in
            let profileJson = interest.profile.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            let pathJson = interest.learningPath.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            try db.execute(
                sql: "INSERT INTO research_interests (id, topic, folder_name, keywords, profile, learning_path, status) VALUES (?,?,?,?,?,?,?)",
                arguments: [
                    interest.id, interest.topic, interest.folderName,
                    interest.keywords?.jsonString, profileJson, pathJson, interest.status
                ]
            )
        }
    }

    func updateInterest(_ interest: ResearchInterest) throws {
        try dbQueue.write { db in
            let profileJson = interest.profile.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            let pathJson = interest.learningPath.flatMap { try? JSONEncoder().encode($0) }
                .flatMap { String(data: $0, encoding: .utf8) }
            try db.execute(
                sql: "UPDATE research_interests SET topic=?, folder_name=?, keywords=?, profile=?, learning_path=?, status=? WHERE id=?",
                arguments: [
                    interest.topic, interest.folderName, interest.keywords?.jsonString,
                    profileJson, pathJson, interest.status, interest.id
                ]
            )
        }
    }

    func deleteInterest(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM research_interests WHERE id = ?", arguments: [id])
        }
    }

    // Knowledge Notes
    func listNotes(researchInterestId: String? = nil) throws -> [KnowledgeNote] {
        try dbQueue.read { db in
            var sql = "SELECT * FROM knowledge_notes"
            var args: [any DatabaseValueConvertible] = []
            if let rid = researchInterestId {
                sql += " WHERE research_interest_id = ?"
                args.append(rid)
            }
            sql += " ORDER BY created_at DESC"
            return try KnowledgeNote.fetchAll(db, sql: sql, arguments: StatementArguments(args))
        }
    }

    func insertNote(_ note: KnowledgeNote) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO knowledge_notes (id, research_interest_id, title, content, source_type, source_id, tags, embedding) VALUES (?,?,?,?,?,?,?,?)",
                arguments: [
                    note.id, note.researchInterestId, note.title, note.content,
                    note.sourceType, note.sourceId, note.tags?.jsonString,
                    note.embedding?.jsonString
                ]
            )
        }
    }

    func updateNote(_ note: KnowledgeNote) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE knowledge_notes SET title=?, content=?, tags=?, embedding=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                arguments: [note.title, note.content, note.tags?.jsonString, note.embedding?.jsonString, note.id]
            )
        }
    }

    func deleteNote(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM knowledge_notes WHERE id = ?", arguments: [id])
        }
    }

    func getNotesWithEmbeddings() throws -> [(id: String, content: String, embedding: [Float])] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT id, content, embedding FROM knowledge_notes WHERE embedding IS NOT NULL")
            return rows.compactMap { row in
                guard let embedding: [Float] = row["embedding"]?.jsonDecoded() else { return nil }
                return (id: row["id"], content: row["content"], embedding: embedding)
            }
        }
    }

    // Knowledge Graph
    func listClaims() throws -> [KnowledgeClaim] {
        try dbQueue.read { db in
            try KnowledgeClaim.fetchAll(db, sql: "SELECT * FROM knowledge_graph_claims ORDER BY created_at DESC")
        }
    }

    func listEvidenceLinks(claimId: String) throws -> [EvidenceLink] {
        try dbQueue.read { db in
            try EvidenceLink.fetchAll(db, sql: "SELECT * FROM knowledge_graph_evidence_links WHERE claim_id = ?", arguments: [claimId])
        }
    }

    func insertClaim(_ claim: KnowledgeClaim) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO knowledge_graph_claims (id, title, statement, research_interest_id, status) VALUES (?,?,?,?,?)",
                arguments: [claim.id, claim.title, claim.statement, claim.researchInterestId, claim.status]
            )
        }
    }

    func updateClaim(_ claim: KnowledgeClaim) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE knowledge_graph_claims SET title=?, statement=?, status=? WHERE id=?",
                arguments: [claim.title, claim.statement, claim.status, claim.id]
            )
        }
    }

    func deleteClaim(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM knowledge_graph_evidence_links WHERE claim_id = ?", arguments: [id])
            try db.execute(sql: "DELETE FROM knowledge_graph_claims WHERE id = ?", arguments: [id])
        }
    }

    func insertEvidenceLink(_ link: EvidenceLink) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT OR IGNORE INTO knowledge_graph_evidence_links (id, claim_id, source_kind, source_id, relation_kind, evidence_summary) VALUES (?,?,?,?,?,?)",
                arguments: [link.id, link.claimId, link.sourceKind, link.sourceId, link.relationKind, link.evidenceSummary]
            )
        }
    }

    func insertCitation(_ citation: PaperCitation) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT OR IGNORE INTO knowledge_paper_citations (id, citing_paper_id, cited_paper_id, context) VALUES (?,?,?,?)",
                arguments: [citation.id, citation.citingPaperId, citation.citedPaperId, citation.context]
            )
        }
    }
}

private extension Encodable {
    var jsonString: String {
        (try? JSONEncoder().encode(self)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
    }
}

private extension DatabaseValueConvertible {
    func jsonDecoded<T: Decodable>() -> T? {
        guard let str = self as? String, let data = str.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}
