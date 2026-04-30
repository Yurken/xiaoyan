import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var selectedTab: Tab = .provider

    enum Tab: String, CaseIterable {
        case general = "通用"
        case provider = "模型服务"
        case rag = "RAG 检索"
        case agents = "多 Agent"
        case papers = "论文"
        case tools = "工具"
        case memory = "记忆"
        case skills = "技能"
        case importExport = "导入/导出"

        var icon: String {
            switch self {
            case .general: return "gear"
            case .provider: return "network"
            case .rag: return "magnifyingglass"
            case .agents: return "cpu"
            case .papers: return "doc.text"
            case .tools: return "wrench"
            case .memory: return "brain"
            case .skills: return "bolt"
            case .importExport: return "arrow.up.arrow.down"
            }
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            List(Tab.allCases, id: \.self, selection: $selectedTab) { tab in
                Label(tab.rawValue, systemImage: tab.icon)
                    .tag(tab)
            }
            .listStyle(.sidebar)
            .frame(width: 160)

            Divider()

            ScrollView {
                Group {
                    switch selectedTab {
                    case .general: GeneralSettingsTab()
                    case .provider: ProviderSettingsTab()
                    case .rag: RAGSettingsTab()
                    case .agents: AgentSettingsTab()
                    case .papers: PaperSettingsTab()
                    case .tools: ToolsSettingsTab()
                    case .memory: MemorySettingsTab()
                    case .skills: SkillsSettingsTab()
                    case .importExport: ImportExportTab()
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationTitle("设置")
    }
}

// MARK: - General

private struct GeneralSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "外观", icon: "paintpalette") {
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

            settingsCard(title: "记忆", icon: "brain") {
                Toggle("启用长期记忆", isOn: boolBinding(for: "xiaoyan_long_term_memory_enabled", in: settings))
            }
        }
    }
}

// MARK: - Provider

private struct ProviderSettingsTab: View {
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

// MARK: - RAG

private struct RAGSettingsTab: View {
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

// MARK: - Agents

private struct AgentSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    private let agentOptions: [(key: String, title: String, subtitle: String)] = [
        ("retrieval", "溯源模型", "检索"),
        ("planner", "谋策模型", "路径规划"),
        ("literature_scout", "探知模型", "论文侦察"),
        ("survey", "翰章模型", "综述生成"),
        ("paper_analyst", "洞见模型", "论文解析"),
        ("reproduction", "构域模型", "复现建议"),
        ("synthesis", "整合模型", "最终整合"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "全局开关", icon: "switch.2") {
                Toggle("启用多 Agent 模式", isOn: boolBinding(for: "multi_agent_enabled", in: settings))

                Picker("路由模式", selection: stringBinding(for: "multi_agent_routing_mode", in: settings)) {
                    Text("规则").tag("rule")
                    Text("模型").tag("llm")
                    Text("混合").tag("hybrid")
                }
            }

            settingsCard(title: "调度限制", icon: "gauge.with.dots.needle.67percent") {
                HStack(spacing: 12) {
                    SettingField(label: "最大步数", key: "multi_agent_max_steps", settings: settings, placeholder: "4")
                    SettingField(label: "检索上限", key: "multi_agent_search_limit", settings: settings, placeholder: "8")
                }
            }

            settingsCard(title: "能力域模型配置", icon: "cpu") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("每个能力域可独立设置模型、地址、密钥和采样参数，留空则继承默认值。")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(agentOptions, id: \.key) { agent in
                        AgentConfigPanel(
                            title: agent.title,
                            subtitle: agent.subtitle,
                            agentKey: agent.key
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Papers

private struct PaperSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "导入识别", icon: "text.viewfinder") {
                Toggle("自动识别标题", isOn: boolBinding(for: "paper_import_recognize_title", in: settings))
                Toggle("自动识别作者", isOn: boolBinding(for: "paper_import_recognize_authors", in: settings))
                Toggle("自动识别年份", isOn: boolBinding(for: "paper_import_recognize_year", in: settings))
                Toggle("自动识别会议/期刊", isOn: boolBinding(for: "paper_import_recognize_venue", in: settings))
                Toggle("自动识别关键词", isOn: boolBinding(for: "paper_import_recognize_keywords", in: settings))
            }

            settingsCard(title: "重命名规则", icon: "textformat") {
                Toggle("导入时自动重命名文件", isOn: boolBinding(for: "paper_auto_rename_on_import", in: settings))
                SettingField(label: "命名规则", key: "paper_auto_rename_rule", settings: settings, placeholder: "{first_author} - {title} ({year})")
            }
        }
    }
}

// MARK: - Tools

private struct ToolsSettingsTab: View {
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

// MARK: - Import/Export

private struct ImportExportTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var exportPassword = ""
    @State private var importPassword = ""
    @State private var importText = ""
    @State private var statusMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "导出设置", icon: "square.and.arrow.up") {
                Text("将当前设置导出为加密文件，可用于备份或迁移")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                SecureField("导出密码", text: $exportPassword)
                    .textFieldStyle(.roundedBorder)
                Button("导出到剪贴板") {
                    exportToClipboard()
                }
                .disabled(exportPassword.isEmpty)
            }

            settingsCard(title: "导入设置", icon: "square.and.arrow.down") {
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

            if let msg = statusMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundStyle(msg.contains("成功") ? .green : .red)
            }

            settingsCard(title: "设置快照", icon: "camera") {
                Button("保存当前快照") {
                    saveSnapshot()
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
    }

    private func exportToClipboard() {
        let service = SettingsService()
        do {
            let base64 = try service.exportSettings(settings: settings.settings, password: exportPassword)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(base64, forType: .string)
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

// MARK: - Memory

private struct MemorySettingsTab: View {
    @State private var memories: [UserMemory] = []
    @State private var observations: [MemoryObservation] = []
    @State private var isLoading = true

    private let memoryRepo = MemoryRepository()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "手动备忘", icon: "bookmark") {
                let manual = memories.filter { $0.type == "manual" }
                if manual.isEmpty {
                    Text("暂无手动备忘。前往「小妍」页侧边栏添加。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(manual) { memory in
                            HStack(alignment: .top, spacing: 8) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(memory.summary)
                                        .font(.caption)
                                    if let date = memory.createdAt {
                                        Text(date, style: .date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Button(action: { deleteMemory(memory) }) {
                                    Image(systemName: "trash")
                                        .font(.caption)
                                        .foregroundStyle(.red)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(8)
                            .background(Color.blue.opacity(0.06))
                            .cornerRadius(8)
                        }
                    }
                }
            }

            settingsCard(title: "自动操作记录", icon: "clock.arrow.circlepath") {
                let auto = memories.filter { $0.type == "auto" }
                if auto.isEmpty {
                    Text("暂无自动记录。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Spacer()
                            Button("清除所有自动记录") {
                                clearAutoMemories()
                            }
                            .font(.caption)
                            .controlSize(.small)
                        }
                        ForEach(auto.prefix(20)) { memory in
                            HStack(alignment: .top, spacing: 8) {
                                Text(memory.summary)
                                    .font(.caption)
                                Spacer()
                                if let date = memory.createdAt {
                                    Text(date, style: .date)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Button(action: { deleteMemory(memory) }) {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(6)
                            .background(Color.gray.opacity(0.06))
                            .cornerRadius(6)
                        }
                    }
                }
            }

            settingsCard(title: "长期记忆观察", icon: "eye") {
                if observations.isEmpty {
                    Text("暂无长期记忆观察。先和小妍对话几轮后，这里会开始出现过程记录。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(observations.prefix(20)) { obs in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(obs.source ?? "未知")
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.12))
                                        .foregroundColor(.blue)
                                        .cornerRadius(4)
                                    Text(obs.title ?? "")
                                        .font(.caption.bold())
                                    Spacer()
                                    if let date = obs.createdAt {
                                        Text(date, style: .date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                if let summary = obs.summary {
                                    Text(summary)
                                        .font(.caption)
                                }
                                if let narrative = obs.narrative {
                                    Text(narrative)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(10)
                            .background(Color.blue.opacity(0.05))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.blue.opacity(0.12), lineWidth: 1)
                            )
                        }
                    }
                }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        isLoading = true
        memories = (try? memoryRepo.listMemories()) ?? []
        observations = (try? memoryRepo.recentObservations(hours: 72 * 30, limit: 100)) ?? []
        isLoading = false
    }

    private func deleteMemory(_ memory: UserMemory) {
        try? memoryRepo.deleteMemory(id: memory.id)
        load()
    }

    private func clearAutoMemories() {
        let auto = memories.filter { $0.type == "auto" }
        for memory in auto {
            try? memoryRepo.deleteMemory(id: memory.id)
        }
        load()
    }
}

// MARK: - Skills

private struct SkillsSettingsTab: View {
    @State private var skills: [Skill] = []
    @State private var isLoading = true
    @State private var searchText = ""

    private let repo = SkillRepository()

    var filteredSkills: [Skill] {
        if searchText.isEmpty { return skills }
        let q = searchText.lowercased()
        return skills.filter {
            $0.title.lowercased().contains(q) ||
            $0.name.lowercased().contains(q) ||
            ($0.descriptionText?.lowercased().contains(q) ?? false) ||
            ($0.tags?.contains(where: { $0.lowercased().contains(q) }) ?? false)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "技能库", icon: "bolt") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("内置研究技能，也可新建自定义技能。在「小妍」对话中通过 /技能名 触发。")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                            .font(.caption)
                        TextField("搜索技能...", text: $searchText)
                            .textFieldStyle(.plain)
                            .font(.caption)
                    }
                    .padding(6)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                }

                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .frame(maxWidth: .infinity, alignment: .center)
                } else if filteredSkills.isEmpty {
                    Text("没有找到匹配的技能")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    let builtin = filteredSkills.filter { $0.isBuiltin == true }
                    let custom = filteredSkills.filter { $0.isBuiltin != true }

                    if !custom.isEmpty {
                        Text("自定义")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220))], spacing: 8) {
                            ForEach(custom) { skill in
                                SkillCard(skill: skill, onToggle: { toggleSkill(skill) })
                            }
                        }
                    }

                    if !builtin.isEmpty {
                        Text("内置技能（共 \(builtin.count) 条）")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220))], spacing: 8) {
                            ForEach(builtin) { skill in
                                SkillCard(skill: skill, onToggle: { toggleSkill(skill) })
                            }
                        }
                    }
                }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        isLoading = true
        try? repo.seedBuiltinsIfNeeded()
        skills = (try? repo.list()) ?? []
        isLoading = false
    }

    private func toggleSkill(_ skill: Skill) {
        try? repo.toggleEnabled(id: skill.id)
        load()
    }
}

private struct SkillCard: View {
    let skill: Skill
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(skill.title)
                    .font(.subheadline.bold())
                if skill.isBuiltin == true {
                    Text("内置")
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                }
                Spacer()
                Toggle("", isOn: Binding(
                    get: { skill.isEnabled ?? true },
                    set: { _ in onToggle() }
                ))
                .toggleStyle(.switch)
                .controlSize(.small)
            }

            if let desc = skill.descriptionText, !desc.isEmpty {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 4) {
                Text("/\(skill.name)")
                    .font(.caption2)
                    .fontDesign(.monospaced)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(4)

                if let tags = skill.tags {
                    ForEach(tags, id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(tagColor(tag).opacity(0.12))
                            .foregroundColor(tagColor(tag))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding(10)
        .background((skill.isEnabled ?? true) ? Color(nsColor: .controlBackgroundColor) : Color.gray.opacity(0.06))
        .cornerRadius(10)
        .opacity((skill.isEnabled ?? true) ? 1.0 : 0.7)
    }

    private func tagColor(_ tag: String) -> Color {
        switch tag {
        case "paper": return .blue
        case "writing": return .purple
        case "survey": return .orange
        case "review": return .red
        case "code": return .green
        case "reproduce": return .teal
        case "planning": return .indigo
        case "translation": return .pink
        default: return .gray
        }
    }
}

// MARK: - Shared Card Style

@ViewBuilder
private func settingsCard(title: String, icon: String, @ViewBuilder content: () -> some View) -> some View {
    VStack(alignment: .leading, spacing: 12) {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .foregroundStyle(.blue)
            Text(title)
                .font(.subheadline.bold())
        }
        content()
    }
    .padding()
    .background(Color(nsColor: .controlBackgroundColor))
    .cornerRadius(12)
}
