import Foundation

struct SemanticScholarClient {
    private static let baseURL = "https://api.semanticscholar.org/graph/v1"

    struct PaperResult: Codable, Identifiable {
        let paperId: String
        let title: String
        let abstract: String?
        let year: Int?
        let citationCount: Int?
        let authors: [Author]
        let url: String?
        let venue: String?

        var id: String { paperId }

        struct Author: Codable {
            let authorId: String?
            let name: String
        }
    }

    struct SearchResponse: Codable {
        let total: Int
        let data: [PaperResult]
    }

    static func search(query: String, limit: Int = 20, apiKey: String? = nil) async throws -> [PaperResult] {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "\(baseURL)/paper/search?query=\(encodedQuery)&limit=\(limit)&fields=paperId,title,abstract,year,citationCount,authors,url,venue"
        guard let url = URL(string: urlString) else { return [] }

        var request = URLRequest(url: url)
        if let apiKey {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        }

        // Retry on 429
        for attempt in 0..<3 {
            let (data, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 429 {
                let delay = UInt64(pow(2.0, Double(attempt))) * 1_000_000_000
                try await Task.sleep(nanoseconds: delay)
                continue
            }
            let result = try JSONDecoder().decode(SearchResponse.self, from: data)
            return result.data
        }
        return []
    }

    static func getPaper(paperId: String, apiKey: String? = nil) async throws -> PaperResult? {
        let urlString = "\(baseURL)/paper/\(paperId)?fields=paperId,title,abstract,year,citationCount,authors,url,venue"
        guard let url = URL(string: urlString) else { return nil }

        var request = URLRequest(url: url)
        if let apiKey {
            request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        }

        let (data, _) = try await URLSession.shared.data(for: request)
        return try? JSONDecoder().decode(PaperResult.self, from: data)
    }

    static func searchURL(query: String) -> URL? {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        return URL(string: "https://www.semanticscholar.org/search?q=\(encoded)")
    }
}
