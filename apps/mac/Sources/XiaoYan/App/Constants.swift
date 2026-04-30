import Foundation

enum AppConstants {
    static let bundleIdentifier = "com.researchcopilot.desktop"
    static let appName = "小妍"
    static let appVersion = "0.3.2"
    static let updateEndpoint = "http://111.231.56.208:18081/xiaoyan-updates/latest.json"

    static var appSupportURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(bundleIdentifier)
    }

    static var databaseURL: URL {
        appSupportURL.appendingPathComponent("xiaoyan.db")
    }

    static var papersDirectory: URL {
        appSupportURL.appendingPathComponent("papers")
    }
}
