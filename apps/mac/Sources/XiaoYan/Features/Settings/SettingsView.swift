import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var selectedTab: Tab = .general

    enum Tab: String, CaseIterable {
        case general = "通用"
        case provider = "LLM 提供商"
        case agents = "多 Agent"
        case importExport = "导入/导出"
    }

    var body: some View {
        HStack(spacing: 0) {
            // Tab sidebar
            List(Tab.allCases, id: \.self, selection: $selectedTab) { tab in
                Label(tab.rawValue, systemImage: tabIcon(tab))
                    .tag(tab)
            }
            .listStyle(.sidebar)
            .frame(width: 160)

            Divider()

            // Content
            Group {
                switch selectedTab {
                case .general: GeneralSettingsTab()
                case .provider: ProviderSettingsTab()
                case .agents: AgentSettingsTab()
                case .importExport: ImportExportTab()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .navigationTitle("设置")
    }

    private func tabIcon(_ tab: Tab) -> String {
        switch tab {
        case .general: return "gear"
        case .provider: return "network"
        case .agents: return "person.3"
        case .importExport: return "arrow.up.arrow.down"
        }
    }
}

// MARK: - General Settings

private struct GeneralSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        ScrollView {
            Form {
                Section("外观") {
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

                Section("嵌入模型") {
                    SettingField(label: "模型", key: "embedding_model", settings: settings)
                    SettingField(label: "Base URL", key: "embedding_base_url", settings: settings, placeholder: "留空则使用 OpenAI URL")
                    SecureSettingField(label: "API Key", key: "embedding_api_key", settings: settings)
                }

                Section("语义搜索") {
                    SettingField(label: "Semantic Scholar API Key", key: "semantic_scholar_api_key", settings: settings, placeholder: "可选")
                    Toggle("启用 Graph RAG", isOn: binding("graph_rag_enabled"))
                }
            }
            .formStyle(.grouped)
            .padding()
        }
    }

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { settings.get(key) == "true" },
            set: { settings.set(key, $0 ? "true" : "false") }
        )
    }
}

// MARK: - Provider Settings

private struct ProviderSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var testResult: String?
    @State private var isTesting = false

    var body: some View {
        ScrollView {
            Form {
                Section("提供商选择") {
                    Picker("主要提供商", selection: binding("llm_provider")) {
                        Text("OpenAI").tag("openai")
                        Text("Anthropic").tag("anthropic")
                        Text("兼容 API").tag("openai_compatible")
                    }
                }

                Section("OpenAI") {
                    SettingField(label: "Model", key: "openai_model", settings: settings)
                    SettingField(label: "Base URL", key: "openai_base_url", settings: settings)
                    SecureSettingField(label: "API Key", key: "openai_api_key", settings: settings)
                }

                Section("Anthropic") {
                    SettingField(label: "Model", key: "anthropic_model", settings: settings)
                    SettingField(label: "Base URL", key: "anthropic_base_url", settings: settings)
                    SecureSettingField(label: "API Key", key: "anthropic_api_key", settings: settings)
                }

                Section("兼容 API (OpenAI-Compatible)") {
                    SettingField(label: "Model", key: "openai_compatible_model", settings: settings)
                    SettingField(label: "Base URL", key: "openai_compatible_base_url", settings: settings, placeholder: "例如 Ollama: http://localhost:11434/v1")
                    SecureSettingField(label: "API Key", key: "openai_compatible_api_key", settings: settings, placeholder: "可留空")
                }

                Section("Vision") {
                    SettingField(label: "Model", key: "vision_model", settings: settings, placeholder: "留空则使用主要模型")
                    SettingField(label: "Base URL", key: "vision_base_url", settings: settings)
                    SecureSettingField(label: "API Key", key: "vision_api_key", settings: settings)
                }

                Section("Copilot 简单模式") {
                    SettingField(label: "Model", key: "copilot_simple_model", settings: settings, placeholder: "留空则使用主要模型")
                    SettingField(label: "Temperature", key: "copilot_simple_temperature", settings: settings)
                }

                Section {
                    HStack {
                        Button("测试连接") {
                            testConnection()
                        }
                        .disabled(isTesting)

                        if isTesting {
                            ProgressView().controlSize(.small)
                        }

                        if let result = testResult {
                            Text(result)
                                .font(.caption)
                                .foregroundStyle(result.contains("成功") ? .green : .red)
                        }
                    }
                }
            }
            .formStyle(.grouped)
            .padding()
        }
    }

    private func binding(_ key: String) -> Binding<String> {
        Binding(
            get: { settings.get(key) ?? "" },
            set: { settings.set(key, $0) }
        )
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

// MARK: - Agent Settings

private struct AgentSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var enabledAgentsText = ""

    private let allAgents = [
        ("planner", "规划师"),
        ("literature_scout", "文献侦察"),
        ("survey", "综述"),
        ("paper_analyst", "论文分析"),
        ("reproduction", "复现"),
    ]

    var body: some View {
        ScrollView {
            Form {
                Section("全局设置") {
                    Toggle("启用多 Agent 模式", isOn: binding("multi_agent_enabled"))
                    Picker("路由模式", selection: stringBinding("multi_agent_routing_mode")) {
                        Text("规则").tag("rule")
                        Text("LLM").tag("llm")
                        Text("混合").tag("hybrid")
                    }
                }

                Section("启用的 Agent") {
                    ForEach(allAgents, id: \.0) { agent in
                        Toggle(agent.1, isOn: agentToggle(agent.0))
                    }
                }

                Section("Synthesis Agent") {
                    SettingField(label: "Model", key: "multi_agent_synthesis_model", settings: settings, placeholder: "留空则使用 Copilot 模型")
                    SettingField(label: "Temperature", key: "multi_agent_synthesis_temperature", settings: settings)
                }

                Section("Worker Agent 通用") {
                    SettingField(label: "Model", key: "multi_agent_worker_model", settings: settings, placeholder: "所有 Worker 的默认模型")
                    SettingField(label: "Temperature", key: "multi_agent_worker_temperature", settings: settings)
                }

                Section("各 Agent 独立配置（可选）") {
                    ForEach(allAgents, id: \.0) { agent in
                        SettingField(
                            label: "\(agent.1) Model",
                            key: "multi_agent_\(agent.0)_model",
                            settings: settings,
                            placeholder: "留空则使用 Worker 通用模型"
                        )
                    }
                }
            }
            .formStyle(.grouped)
            .padding()
        }
        .onAppear {
            enabledAgentsText = settings.get("multi_agent_enabled_agents") ?? ""
        }
    }

    private func stringBinding(_ key: String) -> Binding<String> {
        Binding(
            get: { settings.get(key) ?? "" },
            set: { settings.set(key, $0) }
        )
    }

    private func binding(_ key: String) -> Binding<Bool> {
        Binding(
            get: { settings.get(key) == "true" },
            set: { settings.set(key, $0 ? "true" : "false") }
        )
    }

    private func agentToggle(_ agentName: String) -> Binding<Bool> {
        Binding(
            get: {
                let enabled = (settings.get("multi_agent_enabled_agents") ?? "")
                    .components(separatedBy: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                return enabled.contains(agentName)
            },
            set: { enabled in
                var agents = (settings.get("multi_agent_enabled_agents") ?? "")
                    .components(separatedBy: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
                if enabled && !agents.contains(agentName) {
                    agents.append(agentName)
                } else if !enabled {
                    agents.removeAll { $0 == agentName }
                }
                settings.set("multi_agent_enabled_agents", agents.joined(separator: ","))
            }
        )
    }
}

// MARK: - Import/Export

private struct ImportExportTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var exportPassword = ""
    @State private var importPassword = ""
    @State private var importText = ""
    @State private var exportedText = ""
    @State private var statusMessage: String?
    @State private var showingExport = false
    @State private var showingImport = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Export
                VStack(alignment: .leading, spacing: 8) {
                    Text("导出设置")
                        .font(.headline)
                    Text("将当前设置导出为加密文件，可用于备份或迁移")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    SecureField("导出密码", text: $exportPassword)
                        .textFieldStyle(.roundedBorder)

                    HStack {
                        Button("导出到剪贴板") {
                            exportToClipboard()
                        }
                        .disabled(exportPassword.isEmpty)
                    }
                }
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(10)

                // Import
                VStack(alignment: .leading, spacing: 8) {
                    Text("导入设置")
                        .font(.headline)
                    Text("从加密文件导入设置，将覆盖当前配置")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    TextEditor(text: $importText)
                        .font(.system(.caption, design: .monospaced))
                        .frame(height: 80)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)

                    SecureField("导入密码", text: $importPassword)
                        .textFieldStyle(.roundedBorder)

                    Button("从剪贴板导入") {
                        importFromClipboard()
                    }
                    .disabled(importPassword.isEmpty)
                }
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(10)

                // Status
                if let msg = statusMessage {
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(msg.contains("成功") ? .green : .red)
                        .padding(.horizontal)
                }

                // History
                VStack(alignment: .leading, spacing: 8) {
                    Text("设置快照")
                        .font(.headline)

                    Button("保存当前快照") {
                        saveSnapshot()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                .padding()
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(10)
            }
            .padding()
        }
    }

    private func exportToClipboard() {
        let service = SettingsService()
        do {
            let base64 = try service.exportSettings(settings: settings.settings, password: exportPassword)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(base64, forType: .string)
            exportedText = base64
            statusMessage = "已复制到剪贴板"
        } catch {
            statusMessage = "导出失败: \(error.localizedDescription)"
        }
    }

    private func importFromClipboard() {
        let clipboard = NSPasteboard.general.string(forType: .string) ?? importText
        guard !clipboard.isEmpty else {
            statusMessage = "剪贴板为空"
            return
        }
        let service = SettingsService()
        do {
            let imported = try service.importSettings(base64: clipboard, password: importPassword)
            for (key, value) in imported {
                settings.set(key, value)
            }
            statusMessage = "导入成功，共 \(imported.count) 项设置"
        } catch {
            statusMessage = "导入失败: \(error.localizedDescription)"
        }
    }

    private func saveSnapshot() {
        let service = SettingsService()
        let name = "快照 \(Date().formatted(date: .abbreviated, time: .shortened))"
        do {
            try service.saveSnapshot(name: name, settings: settings.settings)
            statusMessage = "快照已保存"
        } catch {
            statusMessage = "保存失败: \(error.localizedDescription)"
        }
    }
}

// MARK: - Shared Components

private struct SettingField: View {
    let label: String
    let key: String
    @ObservedObject var settings: AppSettings
    var placeholder: String = ""

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)
            TextField(placeholder.isEmpty ? label : placeholder, text: Binding(
                get: { settings.get(key) ?? "" },
                set: { settings.set(key, $0) }
            ))
            .textFieldStyle(.roundedBorder)
        }
    }
}

private struct SecureSettingField: View {
    let label: String
    let key: String
    @ObservedObject var settings: AppSettings
    var placeholder: String = ""
    @State private var isVisible = false
    @State private var text = ""

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)

            Group {
                if isVisible {
                    TextField(placeholder, text: $text)
                } else {
                    SecureField(placeholder, text: $text)
                }
            }
            .textFieldStyle(.roundedBorder)
            .onAppear { text = settings.get(key) ?? "" }
            .onDisappear { settings.set(key, text) }
            .onChange(of: text) { _, newValue in settings.set(key, newValue) }

            Button(action: { isVisible.toggle() }) {
                Image(systemName: isVisible ? "eye.slash" : "eye")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
    }
}
