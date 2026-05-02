import Foundation
import GRDB

struct ResearchInterest: Codable, Identifiable, Hashable, FetchableRecord {
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

struct InterestProfile: Codable, Hashable, FetchableRecord {
    var goal: String?
    var background: String?
    var timeBudget: String?
    var constraints: String?
    var knownContext: String?
    var preferredOutput: String?

    enum CodingKeys: String, CodingKey {
        case goal, background, constraints
        case timeBudget = "time_budget"
        case knownContext = "known_context"
        case preferredOutput = "preferred_output"
    }
}

struct LearningPath: Codable, Hashable, FetchableRecord {
    var overview: String?
    var prerequisites: [LearningPrerequisite]?
    var stages: [LearningStage]?
    var learningStages: [LearningStageDetail]?
    var classicPapers: [ClassicPaper]?
    var researchDirections: [ResearchDirection]?
    var toolsAndFrameworks: [String]?

    enum CodingKeys: String, CodingKey {
        case overview, prerequisites, stages
        case learningStages = "learning_stages"
        case classicPapers = "classic_papers"
        case researchDirections = "research_directions"
        case toolsAndFrameworks = "tools_and_frameworks"
    }
}

struct LearningPrerequisite: Codable, Hashable, FetchableRecord {
    var name: String?
    var description: String?
    var resources: [String]?
}

struct LearningStage: Codable, Hashable, FetchableRecord {
    var title: String?
    var description: String?
    var duration: String?
    var resources: [String]?
}

struct LearningStageDetail: Codable, Hashable, FetchableRecord {
    var stage: Int?
    var title: String?
    var duration: String?
    var goals: [String]?
    var topics: [String]?
    var resources: [String]?
}

struct ClassicPaper: Codable, Hashable, FetchableRecord {
    var title: String?
    var authors: String?
    var year: Int?
    var reason: String?
}

struct ResearchDirection: Codable, Hashable, FetchableRecord {
    var direction: String?
    var description: String?
    var openProblems: [String]?

    enum CodingKeys: String, CodingKey {
        case direction, description
        case openProblems = "open_problems"
    }
}

struct KnowledgeNote: Codable, Identifiable, Hashable, FetchableRecord {
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
