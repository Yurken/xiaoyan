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

    struct SearchRequest {
        var allTerms: [String] = []
        var titleTerms: [String] = []
        var abstractTerms: [String] = []
        var authors: [String] = []
        var categories: [String] = []
        var commentsTerms: [String] = []
        var journalTerms: [String] = []
        var excludeTerms: [String] = []

        var hasSearchTerms: Bool {
            !allTerms.isEmpty || !titleTerms.isEmpty || !abstractTerms.isEmpty
                || !authors.isEmpty || !categories.isEmpty || !commentsTerms.isEmpty
                || !journalTerms.isEmpty
        }
    }

    /// Field-level arXiv search with date window
    static func search(
        request: SearchRequest,
        days: Int = 30,
        maxResults: Int = 20,
        sortBy: String = "submittedDate"
    ) async throws -> [Entry] {
        let query = buildQuery(request: request, days: days)
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "http://export.arxiv.org/api/query?search_query=\(encodedQuery)&start=0&max_results=\(maxResults)&sortBy=\(sortBy)&sortOrder=descending"
        guard let url = URL(string: urlString) else { return [] }

        let (data, _) = try await URLSession.shared.data(from: url)
        let entries = parseAtomXML(data)
        return filterRecent(entries: entries, days: days)
    }

    /// Legacy simple search
    static func search(query: String, start: Int = 0, maxResults: Int = 20, sortBy: String = "relevance") async throws -> [Entry] {
        let encodedQuery = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let urlString = "http://export.arxiv.org/api/query?search_query=all:\(encodedQuery)&start=\(start)&max_results=\(maxResults)&sortBy=\(sortBy)"
        guard let url = URL(string: urlString) else { return [] }

        let (data, _) = try await URLSession.shared.data(from: url)
        return parseAtomXML(data)
    }

    /// Legacy structured search (kept for compat)
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

    // MARK: - Query Builder

    private static func buildQuery(request: SearchRequest, days: Int) -> String {
        var clauses: [String] = []
        if let c = orClause(prefix: "all", terms: request.allTerms, quote: true) { clauses.append(c) }
        if let c = orClause(prefix: "ti", terms: request.titleTerms, quote: true) { clauses.append(c) }
        if let c = orClause(prefix: "abs", terms: request.abstractTerms, quote: true) { clauses.append(c) }
        if let c = orClause(prefix: "au", terms: request.authors, quote: true) { clauses.append(c) }
        if let c = orClause(prefix: "cat", terms: request.categories, quote: false) { clauses.append(c) }
        if let c = orClause(prefix: "co", terms: request.commentsTerms, quote: true) { clauses.append(c) }
        if let c = orClause(prefix: "jr", terms: request.journalTerms, quote: true) { clauses.append(c) }

        let now = Date()
        let start = Calendar.current.date(byAdding: .day, value: -max(days, 1), to: now) ?? now
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyyMMddHHmm"
        let startStr = fmt.string(from: start)
        let endStr = fmt.string(from: now)
        clauses.append("submittedDate:[\(startStr) TO \(endStr)]")

        var query = clauses.joined(separator: " AND ")
        if let exclude = orClause(prefix: "all", terms: request.excludeTerms, quote: true) {
            query += " ANDNOT \(exclude)"
        }
        return query
    }

    private static func orClause(prefix: String, terms: [String], quote: Bool) -> String? {
        let values = terms.map { formatTerm(prefix: prefix, term: $0, quote: quote) }.filter { !$0.isEmpty }
        if values.isEmpty { return nil }
        if values.count == 1 { return values.first }
        return "(\(values.joined(separator: " OR ")))"
    }

    private static func formatTerm(prefix: String, term: String, quote: Bool) -> String {
        let clean = term.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\"", with: " ")
        if clean.isEmpty { return "" }
        if quote {
            return "\(prefix):\"\(clean)\""
        } else {
            return "\(prefix):\(clean.replacingOccurrences(of: " ", with: ""))"
        }
    }

    private static func filterRecent(entries: [Entry], days: Int) -> [Entry] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date.distantPast
        return entries.filter { entry in
            guard let published = entry.published else { return true }
            if let date = ISO8601DateFormatter().date(from: published) {
                return date >= cutoff
            }
            return true
        }
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
