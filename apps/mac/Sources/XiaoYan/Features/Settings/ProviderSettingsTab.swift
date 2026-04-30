import SwiftUI

struct ProviderSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var testResult: String?
    @State private var isTesting = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "主要提供商", icon: "network") {
                Picker("提供商", selection: stringBinding(for: "llm_provider", in: settings)) {
                    Text("OpenAI").tag("openai")
                    Text("Anthropic").tag("anthropic")
                    Text("兼容 API").tag("openai_compatible")
                }
            }

            settingsCard(title: "OpenAI", icon: "bolt") {
                SettingField(label: "Model", key: "openai_model", settings: settings)
                SettingField(label: "Base URL", key: "openai_base_url", settings: settings)
                SecureSettingField(label: "API Key", key: "openai_api_key", settings: settings)
            }

            settingsCard(title: "Anthropic", icon: "a.circle") {
                SettingField(label: "Model", key: "anthropic_model", settings: settings)
                SettingField(label: "Base URL", key: "anthropic_base_url", settings: settings)
                SecureSettingField(label: "API Key", key: "anthropic_api_key", settings: settings)
            }

            settingsCard(title: "兼容 API", icon: "link") {
                SettingField(label: "Model", key: "openai_compatible_model", settings: settings)
                SettingField(label: "Base URL", key: "openai_compatible_base_url", settings: settings, placeholder: "例如 http://localhost:11434/v1")
                SecureSettingField(label: "API Key", key: "openai_compatible_api_key", settings: settings, placeholder: "可留空")
            }

            settingsCard(title: "Copilot 简单模式", icon: "message") {
                SettingField(label: "Model", key: "copilot_simple_model", settings: settings, placeholder: "留空使用主要模型")
                SettingField(label: "Base URL", key: "copilot_simple_base_url", settings: settings)
                SecureSettingField(label: "API Key", key: "copilot_simple_api_key", settings: settings)
                SettingField(label: "Temperature", key: "copilot_simple_temperature", settings: settings)
            }

            HStack {
                Button("测试连接") {
                    testConnection()
                }
                .disabled(isTesting)
                if isTesting { ProgressView().controlSize(.small) }
                if let result = testResult {
                    Text(result)
                        .font(.caption)
                        .foregroundStyle(result.contains("成功") ? .green : .red)
                }
            }
        }
    }

    private func testConnection() {
        isTesting = true
        testResult = nil
        Task {
            let service = SettingsService()
            let success = await service.testConnection(settings: settings)
            testResult = success ? "连接成功!" : "连接失败，请检查配置"
            isTesting = false
        }
    }
}
