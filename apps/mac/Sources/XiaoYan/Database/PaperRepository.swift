import Foundation
import GRDB

struct PaperRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    func list(researchInterestId: String? = nil) throws -> [Paper] {
        try dbQueue.read { db in
            var sql = """
                SELECT p.*, pa.research_question, pa.core_method, pa.experiment_design,
                       pa.experiment_results, pa.innovations, pa.limitations, pa.key_conclusions,
                       rg.code_repository, rg.reproduction_steps
                FROM papers p
                LEFT JOIN paper_analyses pa ON pa.paper_id = p.id
                LEFT JOIN reproduction_guides rg ON rg.paper_id = p.id
            """
            var args: [any DatabaseValueConvertible] = []
            if let rid = researchInterestId {
                sql += " WHERE p.research_interest_id = ?"
                args.append(rid)
            }
            sql += " ORDER BY p.created_at DESC"
            return try Paper.fetchAll(db, sql: sql, arguments: StatementArguments(args))
        }
    }

    func get(id: String) throws -> Paper? {
        try dbQueue.read { db in
            try Paper.fetchOne(db, sql: "SELECT * FROM papers WHERE id = ?", arguments: [id])
        }
    }

    func insert(_ paper: Paper) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO papers (id, title, authors, abstract, year, venue, doi, file_path,
                        full_text, research_interest_id, tags, importance_color, notes, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: [
                    paper.id, paper.title, paper.authors.jsonString, paper.abstractText,
                    paper.year, paper.venue, paper.doi, paper.filePath,
                    paper.fullText, paper.researchInterestId, paper.tags.jsonString,
                    paper.importanceColor, paper.notes, paper.status.rawValue, paper.createdAt
                ]
            )
        }
    }

    func update(_ paper: Paper) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE papers SET title=?, authors=?, abstract=?, year=?, venue=?, doi=?,
                        research_interest_id=?, tags=?, importance_color=?, notes=?, status=?,
                        updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                """,
                arguments: [
                    paper.title, paper.authors.jsonString, paper.abstractText,
                    paper.year, paper.venue, paper.doi, paper.researchInterestId,
                    paper.tags.jsonString, paper.importanceColor, paper.notes,
                    paper.status.rawValue, paper.id
                ]
            )
        }
    }

    func updateStatus(id: String, status: PaperStatus) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE papers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                arguments: [status.rawValue, id]
            )
        }
    }

    func delete(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM papers WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Chunks

    func insertChunks(_ chunks: [PaperChunk]) throws {
        try dbQueue.write { db in
            for chunk in chunks {
                try db.execute(
                    sql: "INSERT INTO paper_chunks (id, paper_id, chunk_index, content, embedding, token_count) VALUES (?,?,?,?,?,?)",
                    arguments: [
                        chunk.id, chunk.paperId, chunk.chunkIndex, chunk.content,
                        chunk.embedding?.jsonString, chunk.tokenCount
                    ]
                )
            }
        }
    }

    func getChunksWithEmbeddings() throws -> [(id: String, content: String, embedding: [Float])] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT id, content, embedding FROM paper_chunks WHERE embedding IS NOT NULL")
            return rows.compactMap { row in
                guard let embedding: [Float] = row["embedding"]?.jsonDecoded() else { return nil }
                return (id: row["id"], content: row["content"], embedding: embedding)
            }
        }
    }

    // MARK: - Analysis

    func upsertAnalysis(_ paperId: String, analysis: PaperAnalysis) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO paper_analyses (paper_id, research_question, core_method, experiment_design,
                        experiment_results, innovations, limitations, key_conclusions, raw_analysis)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(paper_id) DO UPDATE SET
                        research_question=excluded.research_question, core_method=excluded.core_method,
                        experiment_design=excluded.experiment_design, experiment_results=excluded.experiment_results,
                        innovations=excluded.innovations, limitations=excluded.limitations,
                        key_conclusions=excluded.key_conclusions, raw_analysis=excluded.raw_analysis
                """,
                arguments: [
                    paperId, analysis.researchQuestion, analysis.coreMethod,
                    analysis.experimentDesign, analysis.experimentResults,
                    analysis.innovations, analysis.limitations,
                    analysis.keyConclusions, analysis.rawAnalysis
                ]
            )
        }
    }

    // MARK: - Reproduction Guide

    func upsertReproductionGuide(_ paperId: String, guide: ReproductionGuide) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO reproduction_guides (paper_id, code_repository, environment_setup,
                        dependencies, data_requirements, reproduction_steps, expected_results, common_pitfalls, notes)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(paper_id) DO UPDATE SET
                        code_repository=excluded.code_repository, environment_setup=excluded.environment_setup,
                        dependencies=excluded.dependencies, data_requirements=excluded.data_requirements,
                        reproduction_steps=excluded.reproduction_steps, expected_results=excluded.expected_results,
                        common_pitfalls=excluded.common_pitfalls, notes=excluded.notes
                """,
                arguments: [
                    paperId, guide.codeRepository, guide.environmentSetup,
                    guide.dependencies, guide.dataRequirements,
                    guide.reproductionSteps, guide.expectedResults,
                    guide.commonPitfalls, guide.notes
                ]
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
