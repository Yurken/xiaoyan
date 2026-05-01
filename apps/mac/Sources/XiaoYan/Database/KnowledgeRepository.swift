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

    func updateInterestFolder(id: String, folderName: String?) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE research_interests SET folder_name = ? WHERE id = ?",
                arguments: [folderName, id]
            )
        }
    }

    func deleteInterestBundle(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM knowledge_notes WHERE research_interest_id = ?", arguments: [id])
            try db.execute(sql: "DELETE FROM knowledge_graph_claims WHERE research_interest_id = ?", arguments: [id])
            try db.execute(sql: "DELETE FROM research_interests WHERE id = ?", arguments: [id])
        }
    }

    func deleteInterestOnly(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "UPDATE knowledge_notes SET research_interest_id = NULL WHERE research_interest_id = ?", arguments: [id])
            try db.execute(sql: "UPDATE knowledge_graph_claims SET research_interest_id = NULL WHERE research_interest_id = ?", arguments: [id])
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

    func moveNote(id: String, toInterestId: String?) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE knowledge_notes SET research_interest_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                arguments: [toInterestId, id]
            )
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

    func deleteEvidence(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM knowledge_graph_evidence_links WHERE id = ?", arguments: [id])
        }
    }

    func deleteCitation(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM knowledge_paper_citations WHERE id = ?", arguments: [id])
        }
    }

    /// 解析证据链 source 节点的展示标题（paper/note/experiment 共用 title 列）
    func evidenceSourceTitle(kind: String, id: String) throws -> String? {
        let sql: String
        switch kind {
        case "paper": sql = "SELECT title FROM papers WHERE id = ?"
        case "note": sql = "SELECT title FROM knowledge_notes WHERE id = ?"
        case "experiment": sql = "SELECT title FROM experiment_records WHERE id = ?"
        default: return nil
        }
        return try dbQueue.read { db in
            try String.fetchOne(db, sql: sql, arguments: [id])
        }
    }

    /// 检查同一 (claim, source, kind, relation) 组合是否已绑定（UNIQUE 约束键）
    func evidenceLinkExists(claimId: String, sourceKind: String, sourceId: String, relationKind: String) throws -> Bool {
        try dbQueue.read { db in
            let count = try Int.fetchOne(
                db,
                sql: """
                    SELECT COUNT(*) FROM knowledge_graph_evidence_links
                    WHERE claim_id = ? AND source_kind = ? AND source_id = ? AND relation_kind = ?
                """,
                arguments: [claimId, sourceKind, sourceId, relationKind]
            ) ?? 0
            return count > 0
        }
    }

    /// 检查论文引用对 (citing → cited) 是否已存在（UNIQUE 约束键）
    func citationExists(citingPaperId: String, citedPaperId: String) throws -> Bool {
        try dbQueue.read { db in
            let count = try Int.fetchOne(
                db,
                sql: "SELECT COUNT(*) FROM knowledge_paper_citations WHERE citing_paper_id = ? AND cited_paper_id = ?",
                arguments: [citingPaperId, citedPaperId]
            ) ?? 0
            return count > 0
        }
    }

    // MARK: - Semantic Search

    func searchNotes(queryEmbedding: [Float], topK: Int = 5) throws -> [SemanticSearchResult] {
        let rows = try dbQueue.read { db in
            try Row.fetchAll(db, sql: "SELECT id, title, content, embedding FROM knowledge_notes WHERE embedding IS NOT NULL")
        }
        var results: [SemanticSearchResult] = []
        for row in rows {
            guard let embStr: String = row["embedding"],
                  let embData = embStr.data(using: .utf8),
                  let noteEmb = try? JSONDecoder().decode([Float].self, from: embData),
                  !noteEmb.isEmpty else { continue }
            let score = cosineSimilarity(queryEmbedding, noteEmb)
            results.append(SemanticSearchResult(
                id: row["id"] ?? "",
                content: row["content"] ?? "",
                source: row["title"] ?? "",
                score: score
            ))
        }
        results.sort { $0.score > $1.score }
        if results.count > topK {
            results = Array(results.prefix(topK))
        }
        return results
    }

    func listCitations() throws -> [PaperCitation] {
        try dbQueue.read { db in
            try PaperCitation.fetchAll(db, sql: "SELECT * FROM knowledge_paper_citations ORDER BY created_at DESC")
        }
    }

    // MARK: - Snapshot

    func graphSnapshot() throws -> KnowledgeGraphSnapshot {
        let interests = try dbQueue.read { db in
            try ResearchInterest.fetchAll(db, sql: "SELECT * FROM research_interests ORDER BY created_at DESC")
        }
        let papers = try dbQueue.read { db in
            try Paper.fetchAll(db, sql: "SELECT * FROM papers ORDER BY COALESCE(year, 0) DESC, updated_at DESC")
        }
        let notes = try dbQueue.read { db in
            try KnowledgeNote.fetchAll(db, sql: "SELECT * FROM knowledge_notes ORDER BY updated_at DESC")
        }
        let experiments = try dbQueue.read { db in
            try ExperimentRecord.fetchAll(db, sql: "SELECT * FROM experiment_records ORDER BY updated_at DESC")
        }
        let claims = try dbQueue.read { db in
            try KnowledgeClaim.fetchAll(db, sql: "SELECT * FROM knowledge_graph_claims ORDER BY updated_at DESC")
        }
        let evidenceLinks = try dbQueue.read { db in
            try EvidenceLink.fetchAll(db, sql: "SELECT * FROM knowledge_graph_evidence_links ORDER BY created_at DESC")
        }
        let citations = try dbQueue.read { db in
            try PaperCitation.fetchAll(db, sql: "SELECT * FROM knowledge_paper_citations ORDER BY created_at DESC")
        }

        // Filter dangling edges
        let claimIds = Set(claims.map(\.id))
        let paperIds = Set(papers.map(\.id))
        let noteIds = Set(notes.map(\.id))
        let experimentIds = Set(experiments.map(\.id))

        let validEvidence = evidenceLinks.filter { link in
            guard claimIds.contains(link.claimId) else { return false }
            switch link.sourceKind {
            case "paper": return paperIds.contains(link.sourceId)
            case "note": return noteIds.contains(link.sourceId)
            case "experiment": return experimentIds.contains(link.sourceId)
            default: return false
            }
        }

        let validCitations = citations.filter {
            paperIds.contains($0.citingPaperId) && paperIds.contains($0.citedPaperId)
        }

        let summary = KnowledgeGraphSummary(
            interestCount: interests.count,
            paperCount: papers.count,
            noteCount: notes.count,
            experimentCount: experiments.count,
            claimCount: claims.count,
            evidenceCount: validEvidence.count,
            citationCount: validCitations.count
        )

        return KnowledgeGraphSnapshot(
            interests: interests,
            papers: papers,
            notes: notes,
            experiments: experiments,
            claims: claims,
            evidenceLinks: validEvidence,
            citations: validCitations,
            summary: summary
        )
    }
}

struct SemanticSearchResult {
    let id: String
    let content: String
    let source: String
    let score: Float
}

struct KnowledgeGraphSnapshot {
    let interests: [ResearchInterest]
    let papers: [Paper]
    let notes: [KnowledgeNote]
    let experiments: [ExperimentRecord]
    let claims: [KnowledgeClaim]
    let evidenceLinks: [EvidenceLink]
    let citations: [PaperCitation]
    let summary: KnowledgeGraphSummary
}

struct KnowledgeGraphSummary {
    let interestCount: Int
    let paperCount: Int
    let noteCount: Int
    let experimentCount: Int
    let claimCount: Int
    let evidenceCount: Int
    let citationCount: Int
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

func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
    let dot = zip(a, b).map(*).reduce(0, +)
    let na = sqrt(a.map { $0 * $0 }.reduce(0, +))
    let nb = sqrt(b.map { $0 * $0 }.reduce(0, +))
    guard na > 0, nb > 0 else { return 0 }
    return dot / (na * nb)
}
