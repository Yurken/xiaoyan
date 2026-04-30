import Foundation
import GRDB

struct ExperimentRecord: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var title: String
    var config: [String: String]?
    var result: [String: String]?
    var notes: String?
    var linkedSubmissionId: String?
    let createdAt: Date?
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, config, result, notes
        case linkedSubmissionId = "linked_submission_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct ExperimentAttachment: Codable, Identifiable, FetchableRecord {
    let id: String
    var experimentId: String
    var filePath: String
    var label: String?

    enum CodingKeys: String, CodingKey {
        case id
        case experimentId = "experiment_id"
        case filePath = "file_path"
        case label
    }
}
