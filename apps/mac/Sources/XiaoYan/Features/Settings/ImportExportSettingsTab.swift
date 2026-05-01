import SwiftUI

struct ImportExportSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @State private var exportPassword = ""
    @State private var importPassword = ""
    @State private var importText = ""
    @State private var statusMessage: String?
    @State private var snapshots: [SettingsHistory] = []
    @State private var historyBusy = false

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
                    .foregroundStyle(msg.contains("成功") || msg.contains("已应用") || msg.contains("已保存") ? .green : .red)
            }

            settingsCard(title: "设置快照", icon: "camera") {
                VStack(alignment: .leading, spacing: 12) {
                    Button("保存当前快照") {
                        saveSnapshot()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(historyBusy)

                    if !snapshots.isEmpty {
                        Text("历史快照")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)

                        ForEach(snapshots) { snapshot in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(snapshot.name)
                                        .font(.caption)
                                    if let date = snapshot.createdAt {
                                        Text(date.formatted(date: .abbreviated, time: .shortened))
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                                Spacer()
                                Button("应用") {
                                    applySnapshot(snapshot)
                                }
                                .buttonStyle(.borderless)
                                .controlSize(.small)
                                .foregroundStyle(.blue)
                                .disabled(historyBusy)
                                Button("删除") {
                                    deleteSnapshot(snapshot)
                                }
                                .buttonStyle(.borderless)
                                .controlSize(.small)
                                .foregroundStyle(.red)
                                .disabled(historyBusy)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
        }
        .onAppear(perform: loadSnapshots)
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
        guard !historyBusy else { return }
        historyBusy = true
        defer { historyBusy = false }
        let service = SettingsService()
        let name = "快照 \(Date().formatted(date: .abbreviated, time: .shortened))"
        do {
            try service.saveSnapshot(name: name, settings: settings.settings)
            statusMessage = "快照已保存"
            loadSnapshots()
        } catch {
            statusMessage = "保存失败: \(error.localizedDescription)"
        }
    }

    private func applySnapshot(_ snapshot: SettingsHistory) {
        guard !historyBusy else { return }
        historyBusy = true
        defer { historyBusy = false }
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
        guard !historyBusy else { return }
        historyBusy = true
        defer { historyBusy = false }
        let service = SettingsService()
        do {
            try service.deleteSnapshot(id: snapshot.id)
            statusMessage = "快照已删除"
            loadSnapshots()
        } catch {
            statusMessage = "删除失败: \(error.localizedDescription)"
        }
    }
}
