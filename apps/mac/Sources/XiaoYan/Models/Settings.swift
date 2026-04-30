import Foundation
import GRDB

struct SettingsEntry: Codable, FetchableRecord {
    let key: String
    var value: String
    var updatedAt: Date?

    enum CodingKeys: String, CodingKey {
        case key, value
        case updatedAt = "updated_at"
    }
}

struct SettingsHistory: Codable, Identifiable, FetchableRecord {
    let id: String
    var name: String
    var settingsJson: String
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name
        case settingsJson = "settings_json"
        case createdAt = "created_at"
    }
}

enum LLMProvider: String, Codable {
    case openai, anthropic, openaiCompatible = "openai_compatible"
}

struct LLMConfig {
    let provider: LLMProvider
    let model: String
    let baseURL: String
    let apiKey: String
    let temperature: Double
    let maxTokens: Int
}
