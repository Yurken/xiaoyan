import SwiftUI

@main
struct XiaoYanApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var router = AppRouter()
    @StateObject private var settings = AppSettings()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(router)
                .environmentObject(settings)
                .frame(minWidth: 900, minHeight: 600)
                .onAppear {
                    DatabaseManager.shared.setup()
                    settings.loadFromStore()
                }
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .defaultSize(width: 1280, height: 800)
        .commands {
            XiaoYanCommands()
        }

        Settings {
            SettingsView()
                .environmentObject(settings)
                .frame(width: 680, height: 520)
        }
    }
}

struct ContentView: View {
    @EnvironmentObject var router: AppRouter

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            router.destinationView
        }
    }
}
