import Foundation

struct ArxivClient {
    struct SearchResult: Codable {
        let entries: [Entry]
    }

    struct Entry: Codable, Identifiable {
        let id: String
        let title: String
        let summary: String
        let authors: [String]
        let published: String?
        let categories: [String]
        let pdfURL: String?

        enum CodingKeys: String, CodingKey {
            case id, title, summary, authors, published, categories
            case pdfURL = "pdf_url"
        }
    }

    /// Search arXiv using the Atom XML API
    static func search(query: String, start: Int = 0, maxResults: Int = 20, sortBy: String = "relevance") async throws -> [Entry] {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "http://export.arxiv.org/api/query?search_query=all:\(encodedQuery)&start=\(start)&max_results=\(maxResults)&sortBy=\(sortBy)"
        guard let url = URL(string: urlString) else { return [] }

        let (data, _) = try await URLSession.shared.data(from: url)
        return parseAtomXML(data)
    }

    /// Structured search with specific fields
    static func structuredSearch(
        title: String? = nil,
        abstract: String? = nil,
        author: String? = nil,
        category: String? = nil,
        start: Int = 0,
        maxResults: Int = 20
    ) async throws -> [Entry] {
        var parts: [String] = []
        if let title, !title.isEmpty { parts.append("ti:\(title)") }
        if let abstract, !abstract.isEmpty { parts.append("abs:\(abstract)") }
        if let author, !author.isEmpty { parts.append("au:\(author)") }
        if let category, !category.isEmpty { parts.append("cat:\(category)") }

        let query = parts.isEmpty ? "" : parts.joined(separator: "+AND+")
        return try await search(query: query, start: start, maxResults: maxResults)
    }

    // MARK: - Atom XML Parsing

    private static func parseAtomXML(_ data: Data) -> [Entry] {
        guard let xml = String(data: data, encoding: .utf8) else { return [] }

        var entries: [Entry] = []
        let entryBlocks = xml.components(separatedBy: "<entry>").dropFirst()

        for block in entryBlocks {
            guard let endIndex = block.range(of: "</entry>") else { continue }
            let entryXML = String(block[block.startIndex..<endIndex.lowerBound])

            let id = extractTag("id", from: entryXML) ?? ""
            let title = extractTag("title", from: entryXML)?
                .replacingOccurrences(of: "\n", with: " ")
                .replacingOccurrences(of: "  ", with: " ")
                .trimmingCharacters(in: .whitespaces) ?? ""
            let summary = extractTag("summary", from: entryXML)?
                .replacingOccurrences(of: "\n", with: " ")
                .trimmingCharacters(in: .whitespaces) ?? ""
            let published = extractTag("published", from: entryXML)

            // Extract authors
            var authors: [String] = []
            let authorBlocks = entryXML.components(separatedBy: "<author>")
            for ab in authorBlocks.dropFirst() {
                if let name = extractTag("name", from: ab) {
                    authors.append(name)
                }
            }

            // Extract categories
            var categories: [String] = []
            let catRegex = try? NSRegularExpression(pattern: "term=\"([^\"]+)\"")
            let nsString = entryXML as NSString
            let matches = catRegex?.matches(in: entryXML, range: NSRange(location: 0, length: nsString.length)) ?? []
            for match in matches {
                if match.range.location != NSNotFound {
                    categories.append(nsString.substring(with: match.range(at: 1)))
                }
            }

            // Extract PDF link
            var pdfURL: String?
            if let pdfRange = entryXML.range(of: "href=\""),
               let endRange = entryXML[pdfRange.upperBound...].range(of: "\""),
               entryXML[pdfRange.lowerBound...].contains("pdf") {
                pdfURL = String(entryXML[pdfRange.upperBound..<endRange.lowerBound])
            }

            entries.append(Entry(
                id: id, title: title, summary: summary,
                authors: authors, published: published,
                categories: categories, pdfURL: pdfURL
            ))
        }
        return entries
    }

    private static func extractTag(_ tag: String, from xml: String) -> String? {
        guard let startRange = xml.range(of: "<\(tag)>"),
              let endRange = xml.range(of: "</\(tag)>") else { return nil }
        return String(xml[startRange.upperBound..<endRange.lowerBound])
    }
}
