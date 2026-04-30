import Foundation

struct SourceService {
    /// Unified lookup: search both journal partitions and CCF catalog
    static func lookup(query: String) -> SourceLookupResult {
        let journal = searchJournal(query: query)
        let ccf = searchCCF(query: query)
        return SourceLookupResult(journal: journal, ccf: ccf)
    }

    static func searchJournal(query: String) -> JournalPartition? {
        let journals = JournalDataStore.shared.journals
        let q = query.lowercased()

        // Exact ISSN match
        for j in journals {
            if j.issn == query || j.eissn == query { return j }
        }

        // Title match (scored)
        var best: JournalPartition?
        var bestScore = 0.0
        for j in journals {
            let title = j.title.lowercased()
            if title == q { return j }
            if title.contains(q) {
                let score = Double(q.count) / Double(title.count)
                if score > bestScore {
                    bestScore = score
                    best = j
                }
            }
        }
        return best
    }

    static func searchCCF(query: String) -> CCFCatalogEntry? {
        let entries = CCFDataStore.shared.entries
        let q = query.lowercased()

        for entry in entries {
            if entry.label.lowercased() == q { return entry }
            if entry.fullName?.lowercased() == q { return entry }
            if entry.aliases?.contains(where: { $0.lowercased() == q }) == true { return entry }
        }

        // Partial match
        return entries.first { entry in
            entry.label.lowercased().contains(q) || entry.fullName?.lowercased().contains(q) == true
        }
    }

    /// Infer venue from text (e.g., paper title/header)
    static func inferFromText(_ text: String) -> CCFCatalogEntry? {
        let entries = CCFDataStore.shared.entries
        for entry in entries {
            if text.lowercased().contains(entry.label.lowercased()) {
                return entry
            }
        }
        return nil
    }
}

// MARK: - Data Stores (lazy-loaded embedded JSON)

final class JournalDataStore {
    static let shared = JournalDataStore()
    private(set) var journals: [JournalPartition] = []

    private init() {
        if let url = Bundle.main.url(forResource: "journal_partitions", withExtension: "json"),
           let data = try? Data(contentsOf: url) {
            journals = (try? JSONDecoder().decode([JournalPartition].self, from: data)) ?? []
        }
    }
}

final class CCFDataStore {
    static let shared = CCFDataStore()
    private(set) var entries: [CCFCatalogEntry] = []

    private init() {
        if let url = Bundle.main.url(forResource: "ccf_catalog", withExtension: "json"),
           let data = try? Data(contentsOf: url) {
            entries = (try? JSONDecoder().decode([CCFCatalogEntry].self, from: data)) ?? []
        }
    }
}
