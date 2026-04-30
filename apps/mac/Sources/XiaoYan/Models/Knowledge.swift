import Foundation
import GRDB

struct ResearchInterest: Codable, Identifiable, FetchableRecord {
    let id: String
    var topic: String
    var folderName: String?
    var keywords: [String]?
    var profile: InterestProfile?
    var learningPath: LearningPath?
    var status: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, topic, keywords, profile, status
        case folderName = "folder_name"
        case learningPath = "learning_path"
        case createdAt = "created_at"
    }
}

struct InterestProfile: Codable, FetchableRecord {
    var goal: String?
    var background: String?
    var timeBudget: String?
    var constraints: String?

    enum CodingKeys: String, CodingKey {
        case goal, background, constraints
        case timeBudget = "time_budget"
    }
}

struct LearningPath: Codable, FetchableRecord {
    var stages: [LearningStage]?
}

struct LearningStage: Codable, FetchableRecord {
    var title: String?
    var description: String?
    var duration: String?
    var resources: [String]?
}

struct KnowledgeNote: Codable, Identifiable, FetchableRecord {
    let id: String
    var researchInterestId: String?
    var title: String
    var content: String
    var sourceType: String?
    var sourceId: String?
    var tags: [String]?
    var embedding: [Float]?
    let createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, content, tags, embedding
        case researchInterestId = "research_interest_id"
        case sourceType = "source_type"
        case sourceId = "source_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
