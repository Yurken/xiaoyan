import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        TabView {
            GeneralSettingsTab()
                .tabItem { Label("通用", systemImage: "gear") }

            ProviderSettingsTab()
                .tabItem { Label("LLM 提供商", systemImage: "network") }

            AgentSettingsTab()
                .tabItem { Label("多 Agent", systemImage: "person.3") }
        }
        .padding()
    }
}

private struct GeneralSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        Form {
            Picker("主题", selection: $settings.theme) {
                ForEach(AppTheme.allCases, id: \.self) { theme in
                    Text(theme.displayName).tag(theme)
                }
            }
            Picker("风格", selection: $settings.style) {
                ForEach(AppStyle.allCases, id: \.self) { style in
                    Text(style.displayName).tag(style)
                }
            }
        }
        .formStyle(.grouped)
    }
}

private struct ProviderSettingsTab: View {
    var body: some View {
        Form {
            Section("LLM 提供商") {
                Text("配置 OpenAI / Anthropic / 兼容 API")
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
    }
}

private struct AgentSettingsTab: View {
    var body: some View {
        Form {
            Section("多 Agent 配置") {
                Text("配置 Agent 路由、模型分配")
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
    }
}
