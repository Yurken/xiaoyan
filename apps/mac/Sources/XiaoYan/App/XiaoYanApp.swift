import SwiftUI

@main
struct XiaoYanApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var router = AppRouter()
    @StateObject private var settings = AppSettings()
    @StateObject private var colorTokens = AppColorTokens()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(router)
                .environmentObject(settings)
                .environmentObject(colorTokens)
                .frame(minWidth: 900, minHeight: 600)
                .preferredColorScheme(effectiveColorScheme)
                .background(colorTokens.backgroundGradient.ignoresSafeArea())
                .onAppear {
                    DatabaseManager.shared.setup()
                    settings.loadFromStore()
                    colorTokens.update(for: resolvedScheme)
                }
                .onChange(of: settings.theme) { _ in
                    colorTokens.update(for: resolvedScheme)
                }
                .onChange(of: effectiveColorScheme) { newValue in
                    if let scheme = newValue {
                        colorTokens.update(for: scheme)
                    }
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
                .environmentObject(colorTokens)
                .frame(width: 680, height: 520)
                .preferredColorScheme(effectiveColorScheme)
        }
    }

    private var effectiveColorScheme: ColorScheme? {
        switch settings.theme {
        case .dark: return .dark
        case .light: return .light
        case .system: return nil
        }
    }

    private var resolvedScheme: ColorScheme {
        effectiveColorScheme ?? .dark
    }
}

struct ContentView: View {
    @EnvironmentObject var router: AppRouter

    var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 76, ideal: 76, max: 76)
        } detail: {
            router.destinationView
        }
    }
}
