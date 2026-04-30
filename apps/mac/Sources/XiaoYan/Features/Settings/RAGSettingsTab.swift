import SwiftUI

struct RAGSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "文本切块", icon: "scissors") {
                SettingField(label: "Chunk Size", key: "chunk_size", settings: settings, placeholder: "800")
                SettingField(label: "Chunk Overlap", key: "chunk_overlap", settings: settings, placeholder: "150")
            }

            settingsCard(title: "召回策略", icon: "arrow.up.arrow.down") {
                SettingField(label: "Top-K", key: "rag_top_k", settings: settings, placeholder: "5")
                Toggle("启用 Graph RAG", isOn: boolBinding(for: "graph_rag_enabled", in: settings))
            }

            settingsCard(title: "嵌入模型", icon: "cpu") {
                SettingField(label: "Model", key: "embedding_model", settings: settings)
                SettingField(label: "Base URL", key: "embedding_base_url", settings: settings, placeholder: "留空使用 OpenAI URL")
                SecureSettingField(label: "API Key", key: "embedding_api_key", settings: settings)
            }

            settingsCard(title: "外部学术服务", icon: "building.2") {
                SecureSettingField(label: "Semantic Scholar API Key", key: "semantic_scholar_api_key", settings: settings, placeholder: "可选，留空使用免费额度")
            }
        }
    }
}
