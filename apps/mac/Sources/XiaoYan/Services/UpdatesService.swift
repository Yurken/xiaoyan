import Foundation

struct UpdatesService {
    struct VersionInfo: Codable {
        let version: String
        let url: String?
        let releaseNotes: String?
    }

    static let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"

    static func checkForUpdates() async -> VersionInfo? {
        // Placeholder: in production, fetch from a remote JSON endpoint
        // e.g., https://example.com/api/mac-version.json
        return nil
    }

    static func isNewer(latest: String) -> Bool {
        let current = currentVersion.split(separator: ".").compactMap { Int($0) }
        let remote = latest.split(separator: ".").compactMap { Int($0) }
        for i in 0..<max(current.count, remote.count) {
            let c = i < current.count ? current[i] : 0
            let r = i < remote.count ? remote[i] : 0
            if r > c { return true }
            if r < c { return false }
        }
        return false
    }
}
