import SwiftUI

struct ImportExportSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var activeModal: CryptoModal?
    @State private var statusMessage: String?
    @State private var snapshots: [SettingsHistory] = []
    @State private var historyBusy = false
    @State private var draftName = ""
    @State private var selectedSnapshotId: String = ""
    @State private var applyingId: String?
    @State private var deletingId: String?
    @State private var confirmAction: ConfirmAction?

    enum CryptoModal: Identifiable {
        case export, importConfig
        var id: String {
            switch self {
            case .export: return "export"
            case .importConfig: return "import"
            }
        }
    }

    enum ConfirmAction: Identifiable {
        case apply(id: String), delete(id: String)
        var id: String {
            switch self {
            case .apply(let id): return "apply-\(id)"
            case .delete(let id): return "delete-\(id)"
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "导出设置", icon: "square.and.arrow.up") {
                Text("将当前设置导出为加密文件，可用于备份或迁移")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    activeModal = .export
                } label: {
                    Label("打开加密导出", systemImage: "lock.shield")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            settingsCard(title: "导入设置", icon: "square.and.arrow.down") {
                Text("从加密文件导入设置，将覆盖当前配置")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button {
                    activeModal = .importConfig
                } label: {
                    Label("打开加密导入", systemImage: "lock.open")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            if let msg = statusMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundStyle(msg.contains("成功") || msg.contains("已应用") || msg.contains("已保存") ? .green : .red)
            }

            settingsCard(title: "配置历史", icon: "camera") {
                VStack(alignment: .leading, spacing: 16) {
                    // Save new snapshot
                    HStack(spacing: 8) {
                        TextField("快照名称", text: $draftName)
                            .textFieldStyle(.roundedBorder)
                            .controlSize(.small)
                        Button("保存当前配置") {
                            saveSnapshot()
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                        .disabled(historyBusy || draftName.trimmingCharacters(in: .whitespaces).isEmpty)
                    }

                    // Quick switch
                    if !snapshots.isEmpty {
                        HStack(spacing: 8) {
                            Picker("快速切换", selection: $selectedSnapshotId) {
                                Text("选择配置…").tag("")
                                ForEach(snapshots) { snapshot in
                                    Text(snapshotDisplayName(snapshot)).tag(snapshot.id)
                                }
                            }
                            .pickerStyle(.menu)
                            .controlSize(.small)
                            .frame(minWidth: 220)

                            Button("应用选中配置") {
                                if !selectedSnapshotId.isEmpty {
                                    confirmAction = .apply(id: selectedSnapshotId)
                                }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                            .disabled(historyBusy || selectedSnapshotId.isEmpty)
                        }
                    }

                    // Snapshot list
                    if !snapshots.isEmpty {
                        Text("历史快照")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)

                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(snapshots) { snapshot in
                                snapshotRow(snapshot)
                            }
                        }
                    }
                }
            }
        }
        .onAppear(perform: loadSnapshots)
        .sheet(item: $activeModal) { modal in
            switch modal {
            case .export:
                CryptoConfigModal(
                    mode: .export,
                    onExport: { password in
                        exportToClipboard(password: password)
                    },
                    onImport: { _, _ in }
                )
            case .importConfig:
                CryptoConfigModal(
                    mode: .importConfig,
                    onExport: { _ in },
                    onImport: { cipher, password in
                        importFromClipboard(cipher: cipher, password: password)
                    }
                )
            }
        }
        .confirmationDialog(confirmTitle, isPresented: Binding(
            get: { confirmAction != nil },
            set: { if !$0 { confirmAction = nil } }
        ), titleVisibility: .visible) {
            Button("确认", role: .destructive) {
                switch confirmAction {
                case .apply(let id):
                    if let snapshot = snapshots.first(where: { $0.id == id }) {
                        applySnapshot(snapshot)
                    }
                case .delete(let id):
                    if let snapshot = snapshots.first(where: { $0.id == id }) {
                        deleteSnapshot(snapshot)
                    }
                default: break
                }
                confirmAction = nil
            }
            Button("取消", role: .cancel) {
                confirmAction = nil
            }
        } message: {
            Text(confirmMessage)
        }
    }

    // MARK: - Snapshot Row

    private func snapshotRow(_ snapshot: SettingsHistory) -> some View {
        let meta = snapshotMetadata(snapshot)
        let isApplying = applyingId == snapshot.id
        let isDeleting = deletingId == snapshot.id

        return VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(snapshot.name)
                        .font(.caption.bold())
                    if let date = snapshot.createdAt {
                        Text(date.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                Spacer()
                HStack(spacing: 6) {
                    if isApplying {
                        ProgressView().controlSize(.mini)
                        Text("应用中…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } else {
                        Button("应用") {
                            confirmAction = .apply(id: snapshot.id)
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.small)
                        .foregroundStyle(.blue)
                    }

                    if isDeleting {
                        ProgressView().controlSize(.mini)
                        Text("删除中…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    } else {
                        Button("删除") {
                            confirmAction = .delete(id: snapshot.id)
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.small)
                        .foregroundStyle(.red)
                    }
                }
            }

            // Metadata chips
            if !meta.isEmpty {
                HStack(spacing: 6) {
                    ForEach(meta, id: \.self) { chip in
                        Text(chip)
                            .font(.caption2)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.secondary.opacity(0.1))
                            .foregroundStyle(.secondary)
                            .cornerRadius(12)
                    }
                }
            }
        }
        .padding(10)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Metadata Extraction

    private func snapshotMetadata(_ snapshot: SettingsHistory) -> [String] {
        guard let data = snapshot.settingsJson.data(using: .utf8),
              let dict = try? JSONDecoder().decode([String: String].self, from: data) else {
            return []
        }
        var chips: [String] = []

        let providerLabels: [String: String] = [
            "openai": "OpenAI",
            "anthropic": "Anthropic",
            "openai_compatible": "兼容 OpenAI",
            "ollama": "Ollama",
        ]
        if let provider = dict["llm_provider"], !provider.isEmpty {
            chips.append(providerLabels[provider] ?? provider)
        }

        let model = dict["openai_chat_model"] ?? dict["anthropic_chat_model"] ?? dict["openai_compatible_chat_model"] ?? ""
        if !model.isEmpty {
            chips.append(model)
        }

        let searchLabels: [String: String] = [
            "arxiv": "arXiv",
            "semantic_scholar": "Semantic Scholar",
        ]
        if let engine = dict["paper_search_engine"], !engine.isEmpty {
            chips.append(searchLabels[engine] ?? engine)
        }

        if dict["multi_agent_enabled"] == "true" {
            chips.append("多 Agent")
        }

        return chips
    }

    private func snapshotDisplayName(_ snapshot: SettingsHistory) -> String {
        if let date = snapshot.createdAt {
            return "\(snapshot.name) · \(date.formatted(date: .numeric, time: .shortened))"
        }
        return snapshot.name
    }

    // MARK: - Confirmation

    private var confirmTitle: String {
        switch confirmAction {
        case .apply: return "确认应用此配置？"
        case .delete: return "确认删除此快照？"
        default: return ""
        }
    }

    private var confirmMessage: String {
        switch confirmAction {
        case .apply: return "应用后，当前配置会被覆盖并立即生效。"
        case .delete: return "删除后将无法恢复。"
        default: return ""
        }
    }

    // MARK: - Actions

    private func exportToClipboard(password: String) {
        let service = SettingsService()
        do {
            let base64 = try service.exportSettings(settings: settings.settings, password: password)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(base64, forType: .string)
            statusMessage = "已复制到剪贴板"
        } catch {
            statusMessage = "导出失败: \(error.localizedDescription)"
        }
    }

    private func importFromClipboard(cipher: String, password: String) {
        let service = SettingsService()
        do {
            let imported = try service.importSettings(base64: cipher, password: password)
            settings.apply(imported)
            statusMessage = "导入成功，共 \(imported.count) 项设置"
        } catch {
            statusMessage = "导入失败: \(error.localizedDescription)"
        }
    }

    private func loadSnapshots() {
        let service = SettingsService()
        snapshots = service.listSnapshots()
    }

    private func saveSnapshot() {
        let name = draftName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, !historyBusy else { return }
        historyBusy = true
        defer { historyBusy = false }
        let service = SettingsService()
        do {
            try service.saveSnapshot(name: name, settings: settings.settings)
            statusMessage = "快照已保存"
            draftName = ""
            loadSnapshots()
        } catch {
            statusMessage = "保存失败: \(error.localizedDescription)"
        }
    }

    private func applySnapshot(_ snapshot: SettingsHistory) {
        guard applyingId == nil else { return }
        applyingId = snapshot.id
        defer { applyingId = nil }
        let service = SettingsService()
        do {
            let applied = try service.applySnapshot(id: snapshot.id)
            settings.apply(applied, persist: false)
            statusMessage = "已应用 \(applied.count) 项设置"
        } catch {
            statusMessage = "应用失败: \(error.localizedDescription)"
        }
    }

    private func deleteSnapshot(_ snapshot: SettingsHistory) {
        guard deletingId == nil else { return }
        deletingId = snapshot.id
        defer { deletingId = nil }
        let service = SettingsService()
        do {
            try service.deleteSnapshot(id: snapshot.id)
            statusMessage = "快照已删除"
            if selectedSnapshotId == snapshot.id {
                selectedSnapshotId = ""
            }
            loadSnapshots()
        } catch {
            statusMessage = "删除失败: \(error.localizedDescription)"
        }
    }
}
