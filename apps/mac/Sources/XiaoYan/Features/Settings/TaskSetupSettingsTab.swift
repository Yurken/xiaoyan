import SwiftUI

struct TaskSetupSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "默认参数", icon: "slider.horizontal.3") {
                HStack(spacing: 12) {
                    SettingField(label: "默认温度", key: "default_temperature", settings: settings, placeholder: "0.7")
                    SettingField(label: "最大 Token", key: "default_max_tokens", settings: settings, placeholder: "4096")
                }
            }

            settingsCard(title: "论文处理", icon: "doc.text") {
                HStack(spacing: 12) {
                    SettingField(label: "分块大小", key: "chunk_size", settings: settings, placeholder: "800")
                    SettingField(label: "重叠长度", key: "chunk_overlap", settings: settings, placeholder: "150")
                }
                SettingField(label: "嵌入批次", key: "embedding_batch_size", settings: settings, placeholder: "20")
            }

            settingsCard(title: "任务行为", icon: "gearshape.2") {
                Toggle("自动分析上传论文", isOn: boolBinding(for: "auto_analyze_upload", in: settings))
                Toggle("自动保存对话", isOn: boolBinding(for: "auto_save_chat", in: settings))
            }
        }
    }
}
