import Foundation

struct EmbeddingClient {
    let baseURL: String
    let apiKey: String
    let model: String

    static func fromSettings(_ settings: [String: String]) -> EmbeddingClient? {
        guard let model = settings["embedding_model"], !model.isEmpty else { return nil }
        return EmbeddingClient(
            baseURL: settings["embedding_base_url"] ?? settings["openai_base_url"] ?? "https://api.openai.com",
            apiKey: settings["embedding_api_key"] ?? settings["openai_api_key"] ?? "",
            model: model
        )
    }

    @MainActor
    static func fromSettings(_ settings: AppSettings) -> EmbeddingClient? {
        fromSettings(settings.settings)
    }

    func embed(texts: [String]) async throws -> [[Float]] {
        let url = URL(string: "\(baseURL)/embeddings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = ["model": model, "input": texts]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let dataArray = json["data"] as? [[String: Any]] else {
            throw EmbeddingError.invalidResponse
        }

        return dataArray.compactMap { item in
            (item["embedding"] as? [NSNumber])?.map { $0.floatValue }
        }
    }

    func embed(text: String) async throws -> [Float] {
        let results = try await embed(texts: [text])
        guard let first = results.first else {
            throw EmbeddingError.emptyResult
        }
        return first
    }
}

enum EmbeddingError: LocalizedError {
    case invalidResponse
    case emptyResult

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "无效的嵌入 API 响应"
        case .emptyResult: return "嵌入结果为空"
        }
    }
}
