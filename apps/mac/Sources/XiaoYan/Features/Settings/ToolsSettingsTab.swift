import SwiftUI

struct ToolsSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "Vision", icon: "eye") {
                SettingField(label: "Model", key: "vision_model", settings: settings, placeholder: "留空使用主要模型")
                SettingField(label: "Base URL", key: "vision_base_url", settings: settings)
                SecureSettingField(label: "API Key", key: "vision_api_key", settings: settings)
                SettingField(label: "Temperature", key: "vision_temperature", settings: settings)
            }

            settingsCard(title: "学术翻译", icon: "character") {
                SettingField(label: "Model", key: "translation_model", settings: settings, placeholder: "留空使用主要模型")
                SettingField(label: "Base URL", key: "translation_base_url", settings: settings)
                SecureSettingField(label: "API Key", key: "translation_api_key", settings: settings)
                SettingField(label: "Temperature", key: "translation_temperature", settings: settings)
            }
        }
    }
}
