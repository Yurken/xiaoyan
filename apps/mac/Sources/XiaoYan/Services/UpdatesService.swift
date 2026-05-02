import Foundation
import AppKit

struct UpdatesService {
    struct VersionInfo {
        let version: String
        let url: String
        let releaseNotes: String?
        let pubDate: String?
    }

    enum UpdateCheckError: Error, LocalizedError {
        case invalidEndpoint
        case network(Error)
        case http(statusCode: Int)
        case decode(Error)
        case missingPlatformURL
        case downloadFailed(Error)

        var errorDescription: String? {
            switch self {
            case .invalidEndpoint: return "更新服务端点配置无效"
            case .network(let error): return "网络错误：\(error.localizedDescription)"
            case .http(let code): return "服务器返回错误 HTTP \(code)"
            case .decode(let error): return "解析更新信息失败：\(error.localizedDescription)"
            case .missingPlatformURL: return "未找到适用于当前平台的下载链接"
            case .downloadFailed(let error): return "下载失败：\(error.localizedDescription)"
            }
        }
    }

    enum UpdateCheckOutcome {
        case noUpdate
        case hasUpdate(VersionInfo)
    }

    enum DownloadState {
        case idle
        case downloading
        case downloaded(URL)
        case failed(Error)
    }

    static let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"

    static func checkForUpdates() async -> Result<UpdateCheckOutcome, UpdateCheckError> {
        guard let endpoint = URL(string: AppConstants.updateEndpoint) else {
            return .failure(.invalidEndpoint)
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: endpoint)
            guard let httpResponse = response as? HTTPURLResponse else {
                return .failure(.http(statusCode: 0))
            }
            guard httpResponse.statusCode == 200 else {
                return .failure(.http(statusCode: httpResponse.statusCode))
            }
            let manifest: TauriUpdaterManifest
            do {
                manifest = try JSONDecoder().decode(TauriUpdaterManifest.self, from: data)
            } catch {
                return .failure(.decode(error))
            }
            guard isNewer(latest: manifest.version) else {
                return .success(.noUpdate)
            }
            guard let platformUrl = platformURL(from: manifest.platforms) else {
                return .failure(.missingPlatformURL)
            }
            let info = VersionInfo(
                version: manifest.version,
                url: platformUrl,
                releaseNotes: manifest.notes,
                pubDate: manifest.pubDate
            )
            return .success(.hasUpdate(info))
        } catch let error as UpdateCheckError {
            return .failure(error)
        } catch {
            return .failure(.network(error))
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

    static func openDownloadURL(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        NSWorkspace.shared.open(url)
    }

    static func downloadAndInstall(url: String) async -> Result<URL, UpdateCheckError> {
        guard let sourceURL = URL(string: url) else {
            return .failure(.invalidEndpoint)
        }
        do {
            let (downloadURL, response) = try await URLSession.shared.download(from: sourceURL)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return .failure(.http(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0))
            }
            // Move to Downloads folder with a meaningful name
            let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first!
            let filename = sourceURL.lastPathComponent.isEmpty ? "XiaoYan-Update.dmg" : sourceURL.lastPathComponent
            let destination = downloads.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: downloadURL, to: destination)
            NSWorkspace.shared.open(destination)
            return .success(destination)
        } catch let error as UpdateCheckError {
            return .failure(error)
        } catch {
            return .failure(.downloadFailed(error))
        }
    }

    // MARK: - Tauri Manifest

    private struct TauriUpdaterManifest: Codable {
        let version: String
        let notes: String?
        let pubDate: String?
        let platforms: [String: PlatformInfo]

        enum CodingKeys: String, CodingKey {
            case version, notes, platforms
            case pubDate = "pub_date"
        }
    }

    private struct PlatformInfo: Codable {
        let url: String
        let signature: String?
    }

    private static func platformURL(from platforms: [String: PlatformInfo]) -> String? {
        // Try native architecture first, then x86_64 fallback (Rosetta)
        let candidates = [currentPlatformKey, "darwin-x86_64"]
        for key in candidates {
            if let info = platforms[key] {
                return info.url
            }
        }
        // Fallback: any darwin platform
        return platforms.first { $0.key.hasPrefix("darwin") }?.value.url
    }

    private static var currentPlatformKey: String {
        var sysinfo = utsname()
        uname(&sysinfo)
        let machine = withUnsafeBytes(of: &sysinfo.machine) { raw -> String in
            let buffer = raw.bindMemory(to: CChar.self)
            return String(cString: buffer.baseAddress!)
        }
        if machine == "arm64" {
            return "darwin-aarch64"
        }
        return "darwin-x86_64"
    }
}
