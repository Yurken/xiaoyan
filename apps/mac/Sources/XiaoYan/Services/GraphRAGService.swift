import Foundation
import GRDB

struct GraphRAGService {
    struct ClaimResult: Identifiable {
        let id: String
        let title: String
        let statement: String
        let relationKind: String
        let score: Double
        let evidenceSummary: String?
    }

    static func searchClaimProvenance(
        queryEmbedding: [Float],
        dbQueue: DatabaseQueue,
        topK: Int = 5
    ) -> [ClaimResult] {
        do {
            return try dbQueue.read { dbConn in
                let rows = try Row.fetchAll(dbConn, sql: """
                    SELECT kgcl.id, kgcl.title, kgcl.statement, kgel.relation_kind, kgel.evidence_summary
                    FROM knowledge_graph_evidence_links kgel
                    JOIN knowledge_graph_claims kgcl ON kgcl.id = kgel.claim_id
                    ORDER BY kgcl.created_at DESC
                    LIMIT ?
                """, arguments: [topK])

                return rows.map { row in
                    ClaimResult(
                        id: row["id"],
                        title: row["title"],
                        statement: row["statement"],
                        relationKind: row["relation_kind"],
                        score: 0.5,
                        evidenceSummary: row["evidence_summary"]
                    )
                }
            }
        } catch {
            return []
        }
    }

    static func buildGraphRAGContext(claims: [ClaimResult]) -> String {
        guard !claims.isEmpty else { return "" }

        var context = "[GraphRAG 图谱溯源]\n"
        for claim in claims {
            context += "- \(claim.title): \(claim.statement)"
            if let summary = claim.evidenceSummary {
                context += " (证据: \(summary))"
            }
            context += " [\(claim.relationKind)]\n"
        }
        return context
    }

    static func collectGraphRAGSources(claims: [ClaimResult]) -> [[String: Any]] {
        claims.map { claim in
            [
                "id": claim.id,
                "title": claim.title,
                "score": claim.score,
                "type": "graph_rag"
            ] as [String: Any]
        }
    }
}
