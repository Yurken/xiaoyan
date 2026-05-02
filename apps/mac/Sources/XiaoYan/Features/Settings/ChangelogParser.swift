import Foundation

struct ChangelogVersion: Identifiable, Equatable {
    let id = UUID()
    let version: String
    let date: String
    let sections: [ChangelogSection]
}

struct ChangelogSection: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let items: [String]
}

enum ChangelogParser {
    static func loadFromDisk() -> [ChangelogVersion] {
        let candidates = changelogPaths()
        for path in candidates {
            if let data = FileManager.default.contents(atPath: path),
               let text = String(data: data, encoding: .utf8) {
                return parse(text)
            }
        }
        return []
    }

    private static func changelogPaths() -> [String] {
        var paths: [String] = []
        let cwd = FileManager.default.currentDirectoryPath

        // 1. 从 cwd 向上回退（开发时 swift run 的 cwd 通常是 apps/mac）
        let cwdURL = URL(fileURLWithPath: cwd)
        let fromCwd = cwdURL.appendingPathComponent("../../CHANGELOG.md").standardized.path
        paths.append(fromCwd)
        paths.append(cwdURL.appendingPathComponent("CHANGELOG.md").standardized.path)

        // 2. 从 Bundle 路径推断（Release 时 .app 位于 repo 下）
        let bundlePath = Bundle.main.bundlePath
        let bundleURL = URL(fileURLWithPath: bundlePath)
        let fromBundle = bundleURL.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("CHANGELOG.md").standardized.path
        paths.append(fromBundle)

        // 3. 从 resourceURL 推断（SPM 资源模式）
        if let resourceURL = Bundle.main.resourceURL {
            let fromResource = resourceURL.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("CHANGELOG.md").standardized.path
            paths.append(fromResource)
        }

        return Array(Set(paths))
    }

    static func parse(_ text: String) -> [ChangelogVersion] {
        var versions: [ChangelogVersion] = []
        let lines = text.components(separatedBy: .newlines)

        var currentVersion: String?
        var currentDate: String?
        var currentSections: [ChangelogSection] = []
        var currentSectionTitle: String?
        var currentItems: [String] = []

        func flushSection() {
            if let title = currentSectionTitle, !currentItems.isEmpty {
                currentSections.append(ChangelogSection(title: title, items: currentItems))
            }
            currentSectionTitle = nil
            currentItems = []
        }

        func flushVersion() {
            flushSection()
            if let version = currentVersion, let date = currentDate {
                versions.append(ChangelogVersion(version: version, date: date, sections: currentSections))
            }
            currentVersion = nil
            currentDate = nil
            currentSections = []
        }

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Version header: ## [x.y.z] - YYYY-MM-DD
            if trimmed.hasPrefix("## ["), let close = trimmed.firstIndex(of: "]") {
                flushVersion()
                let versionStart = trimmed.index(trimmed.startIndex, offsetBy: 4)
                let version = String(trimmed[versionStart..<close])
                let after = String(trimmed[trimmed.index(after: close)...])
                let date = after.replacingOccurrences(of: "-", with: "").trimmingCharacters(in: .whitespaces)
                currentVersion = version
                currentDate = date.isEmpty ? nil : date
                continue
            }

            // Section header: ### 新增/优化/修复/工程化/重构
            if trimmed.hasPrefix("### ") {
                flushSection()
                currentSectionTitle = String(trimmed.dropFirst(4))
                continue
            }

            // Item: - xxx
            if trimmed.hasPrefix("- "), currentSectionTitle != nil {
                let item = String(trimmed.dropFirst(2))
                if !item.isEmpty {
                    currentItems.append(item)
                }
                continue
            }

            // Empty line or separator
            if trimmed == "---" {
                // ignore separator
            }
        }

        flushVersion()
        return versions
    }
}
