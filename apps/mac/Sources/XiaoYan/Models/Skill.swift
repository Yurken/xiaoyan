import Foundation
import GRDB

struct Skill: Codable, Identifiable, FetchableRecord {
    let id: String
    var name: String
    var title: String
    var descriptionText: String?
    var prompt: String
    var tags: [String]?
    var isBuiltin: Bool?
    var isEnabled: Bool?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, title, prompt, tags
        case descriptionText = "description"
        case isBuiltin = "is_builtin"
        case isEnabled = "is_enabled"
        case createdAt = "created_at"
    }
}
