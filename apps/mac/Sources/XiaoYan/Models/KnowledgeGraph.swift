import Foundation
import GRDB

struct KnowledgeClaim: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var title: String
    var statement: String
    var researchInterestId: String?
    var status: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, statement, status
        case researchInterestId = "research_interest_id"
        case createdAt = "created_at"
    }
}

struct EvidenceLink: Codable, Identifiable, FetchableRecord {
    let id: String
    var claimId: String
    var sourceKind: String
    var sourceId: String
    var relationKind: String
    var evidenceSummary: String?

    enum CodingKeys: String, CodingKey {
        case id
        case claimId = "claim_id"
        case sourceKind = "source_kind"
        case sourceId = "source_id"
        case relationKind = "relation_kind"
        case evidenceSummary = "evidence_summary"
    }
}

struct PaperCitation: Codable, Identifiable, FetchableRecord {
    let id: String
    var citingPaperId: String
    var citedPaperId: String
    var context: String?

    enum CodingKeys: String, CodingKey {
        case id
        case citingPaperId = "citing_paper_id"
        case citedPaperId = "cited_paper_id"
        case context
    }
}

enum RelationKind: String, Codable {
    case supports, contradicts, background
}

struct GraphNode: Identifiable {
    let id: String
    let label: String
    let type: NodeType
}

enum NodeType {
    case paper, note, claim, experiment, interest
}
