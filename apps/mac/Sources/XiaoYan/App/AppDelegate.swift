import SwiftUI
import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.appearance = NSAppearance(named: .darkAqua)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false // Keep app alive for menu bar / dock
    }
}

struct XiaoYanCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .newItem) {
            Button("导入设置...") {
                NotificationCenter.default.post(name: .importSettings, object: nil)
            }
            .keyboardShortcut("i", modifiers: [.command, .shift])

            Button("导出设置...") {
                NotificationCenter.default.post(name: .exportSettings, object: nil)
            }
            .keyboardShortcut("e", modifiers: [.command, .shift])
        }

        CommandGroup(after: .sidebar) {
            Divider()
            Button("切换主题") {
                NotificationCenter.default.post(name: .toggleTheme, object: nil)
            }
            .keyboardShortcut("t", modifiers: [.command, .shift])
        }
    }
}

extension Notification.Name {
    static let importSettings = Notification.Name("importSettings")
    static let exportSettings = Notification.Name("exportSettings")
    static let toggleTheme = Notification.Name("toggleTheme")
}
