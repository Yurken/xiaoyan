import Foundation

struct OllamaClient {
    struct ModelInfo: Codable, Identifiable {
        let name: String
        let model: String?
        let size: Int64?

        var id: String { name }
    }

    struct TagsResponse: Codable {
        let models: [ModelInfo]
    }

    static func listModels(baseURL: String) async throws -> [ModelInfo] {
        let urlString = "\(baseURL)/api/tags"
        guard let url = URL(string: urlString) else { return [] }

        let (data, _) = try await URLSession.shared.data(from: url)
        let response = try JSONDecoder().decode(TagsResponse.self, from: data)
        return response.models
    }
}
