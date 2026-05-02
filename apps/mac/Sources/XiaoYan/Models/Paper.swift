import Foundation
import GRDB

struct Paper: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var title: String
    var authors: [String]
    var abstractText: String?
    var year: Int?
    var venue: String?
    var doi: String?
    var filePath: String?
    var fullText: String?
    var researchInterestId: String?
    var tags: [String]
    var importanceColor: String?
    var notes: String?
    var status: PaperStatus
    let createdAt: Date
    var updatedAt: Date?

    // Joined fields
    var analysis: PaperAnalysis?
    var reproductionGuide: ReproductionGuide?

    enum CodingKeys: String, CodingKey {
        case id, title, authors, year, venue, doi, tags, status, notes
        case abstractText = "abstract"
        case filePath = "file_path"
        case fullText = "full_text"
        case researchInterestId = "research_interest_id"
        case importanceColor = "importance_color"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case analysis, reproductionGuide = "reproduction_guide"
    }
}

enum PaperStatus: String, Codable {
    case uploaded, parsing, parsed, failed, analyzed
}

struct PaperAnalysis: Codable, Identifiable, Hashable {
    let id: String
    let paperId: String
    var researchQuestion: String?
    var coreMethod: String?
    var experimentDesign: String?
    var experimentResults: String?
    var innovations: String?
    var limitations: String?
    var keyConclusions: String?
    var rawAnalysis: String?

    enum CodingKeys: String, CodingKey {
        case id
        case paperId = "paper_id"
        case researchQuestion = "research_question"
        case coreMethod = "core_method"
        case experimentDesign = "experiment_design"
        case experimentResults = "experiment_results"
        case innovations, limitations
        case keyConclusions = "key_conclusions"
        case rawAnalysis = "raw_analysis"
    }
}

struct ReproductionGuide: Codable, Identifiable, Hashable {
    let id: String
    let paperId: String
    var codeRepository: String?
    var environmentSetup: String?
    var dependencies: String?
    var dataRequirements: String?
    var reproductionSteps: String?
    var expectedResults: String?
    var commonPitfalls: String?
    var notes: String?
    // v2 schema align fields
    var datasetPreparation: String?
    var trainingProcess: String?
    var inferenceProcess: String?
    var evaluationMetrics: String?
    var risksAndNotes: String?
    var rawGuide: String?

    enum CodingKeys: String, CodingKey {
        case id
        case paperId = "paper_id"
        case codeRepository = "code_repository"
        case environmentSetup = "environment_setup"
        case dependencies
        case dataRequirements = "data_requirements"
        case reproductionSteps = "reproduction_steps"
        case expectedResults = "expected_results"
        case commonPitfalls = "common_pitfalls"
        case notes
        case datasetPreparation = "dataset_preparation"
        case trainingProcess = "training_process"
        case inferenceProcess = "inference_process"
        case evaluationMetrics = "evaluation_metrics"
        case risksAndNotes = "risks_and_notes"
        case rawGuide = "raw_guide"
    }
}

struct PaperChunk: Codable, Identifiable {
    let id: String
    let paperId: String
    let chunkIndex: Int
    var content: String
    var embedding: [Float]?
    var tokenCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case paperId = "paper_id"
        case chunkIndex = "chunk_index"
        case content, embedding
        case tokenCount = "token_count"
    }
}

struct PaperFigure: Codable, Identifiable, FetchableRecord {
    let id: String
    let paperId: String
    let figIndex: Int
    var caption: String?
    var filePath: String?

    enum CodingKeys: String, CodingKey {
        case id
        case paperId = "paper_id"
        case figIndex = "fig_index"
        case caption
        case filePath = "file_path"
    }
}
