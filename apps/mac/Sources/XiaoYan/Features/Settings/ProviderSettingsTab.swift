import SwiftUI

struct ProviderSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var testResult: String?
    @State private var isTesting = false
    @State private var ollamaModels: [OllamaClient.ModelInfo] = []
    @State private var ollamaLoading = false
    @State private var ollamaError: String?

    private var activePreset: ProviderPresetID { detectPreset(settings.settings) }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "供应商预设", icon: "square.grid.2x2") {
                presetGrid
            }

            if activePreset == .ollama {
                settingsCard(title: "Ollama 本地模型", icon: "shippingbox") {
                    ollamaModelPicker
                }
            }

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

    // MARK: - Preset Grid

    private var presetGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 8)], spacing: 8) {
            ForEach(PROVIDER_PRESETS) { preset in
                presetCard(preset)
            }
        }
    }

    private func presetCard(_ p: ProviderPreset) -> some View {
        let selected = (p.id == activePreset)
        return Button(action: { applyPreset(p.id) }) {
            VStack(alignment: .leading, spacing: 4) {
                Text(p.label).font(.subheadline.bold())
                Text(p.description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(selected ? Color.accentColor.opacity(0.15) : Theme.Colors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(selected ? Color.accentColor : Color.gray.opacity(0.2), lineWidth: 1)
            )
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func applyPreset(_ id: ProviderPresetID) {
        settings.apply(applyPresetEntries(id))
    }

    // MARK: - Ollama Models

    private var ollamaModelPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Button {
                    Task { await loadOllamaModels() }
                } label: {
                    Label("获取本地模型", systemImage: "arrow.clockwise")
                }
                .disabled(ollamaLoading)
                if ollamaLoading { ProgressView().controlSize(.small) }
                Spacer()
                if !ollamaModels.isEmpty {
                    Text("点击模型直接应用")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            if let ollamaError {
                Text(ollamaError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            if !ollamaModels.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 6)], spacing: 6) {
                    ForEach(ollamaModels) { m in
                        Button(m.name) {
                            settings.set("openai_compatible_model", m.name)
                        }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                    }
                }
            }
        }
    }

    private func loadOllamaModels() async {
        ollamaLoading = true
        ollamaError = nil
        let raw = (settings.settings["openai_compatible_base_url"] ?? "")
            .trimmingCharacters(in: .whitespaces)
        let baseURL = raw.isEmpty
            ? "http://localhost:11434"
            : raw.replacingOccurrences(of: "/v1", with: "")
        do {
            ollamaModels = try await OllamaClient.listModels(baseURL: baseURL)
            if ollamaModels.isEmpty {
                ollamaError = "未发现本地模型，请确认 Ollama 已运行"
            }
        } catch {
            ollamaModels = []
            ollamaError = "拉取失败：\(error.localizedDescription)"
        }
        ollamaLoading = false
    }

    // MARK: - Test connection

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
