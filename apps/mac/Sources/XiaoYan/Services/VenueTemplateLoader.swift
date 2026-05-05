import Foundation

struct VenueTemplate: Codable, Identifiable {
    let id: String
    let name: String
    let fullName: String
    let type: String
    let ccf: String
    let area: String
    let publisher: String?
    let sci: Bool?
    let sciQuartile: String?
    let ei: Bool?
    let website: String?
}

enum VenueTemplateLoader {
    static func load() -> [VenueTemplate] {
        guard let url = Bundle.module.url(forResource: "venue_templates", withExtension: "json", subdirectory: "Resources") else { return [] }
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([VenueTemplate].self, from: data)) ?? []
    }

    static func allAreas(from templates: [VenueTemplate]) -> [String] {
        Array(Set(templates.map(\.area))).sorted()
    }
}
