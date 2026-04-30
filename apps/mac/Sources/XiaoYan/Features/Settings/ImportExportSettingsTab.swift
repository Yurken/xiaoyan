import SwiftUI

struct ImportExportSettingsTab: View {
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
