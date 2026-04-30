import Foundation
import AppKit

struct UpdatesService {
    struct VersionInfo: Codable {
        let version: String
        let url: String?
        let releaseNotes: String?
    }

    static let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"

    static func checkForUpdates() async -> VersionInfo? {
        guard let endpoint = URL(string: AppConstants.updateEndpoint) else { return nil }
        do {
            let (data, response) = try await URLSession.shared.data(from: endpoint)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else { return nil }
            let info = try JSONDecoder().decode(VersionInfo.self, from: data)
            return isNewer(latest: info.version) ? info : nil
        } catch {
            return nil
        }
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

    static func openDownloadURL(_ urlString: String?) {
        guard let urlString = urlString, let url = URL(string: urlString) else { return }
        NSWorkspace.shared.open(url)
    }
}
