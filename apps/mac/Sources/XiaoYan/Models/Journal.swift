import Foundation

struct JournalPartition: Codable {
    let title: String
    var issn: String?
    var eissn: String?
    var publisher: String?
    var indexes: [String]?
    var wosCategories: [String]?
    var jcrQuartile: String?
    var jcrCategory: String?
    var jif: Double?
    var jifRank: String?
    var casQuartile: String?
    var casTop: Bool?
    var openAccess: Bool?

    enum CodingKeys: String, CodingKey {
        case title, issn, eissn, publisher, indexes
        case wosCategories = "wos_categories"
        case jcrQuartile = "jcr_quartile"
        case jcrCategory = "jcr_category"
        case jif
        case jifRank = "jif_rank"
        case casQuartile = "cas_quartile"
        case casTop = "cas_top"
        case openAccess = "open_access"
    }
}

struct CCFCatalogEntry: Codable {
    let kind: String
    var rating: String?
    var area: String?
    var label: String
    var fullName: String?
    var publisher: String?
    var url: String?
    var aliases: [String]?

    enum CodingKeys: String, CodingKey {
        case kind, rating, area, label, publisher, url, aliases
        case fullName = "full_name"
    }
}

struct SourceLookupResult {
    let journal: JournalPartition?
    let ccf: CCFCatalogEntry?
}
