import SwiftUI

/// 加密配置导入/导出模态框。
/// 1:1 desktop `CryptoConfigModal.tsx`：双输入确认 + hint + 错误分离。
struct CryptoConfigModal: View {
    enum Mode {
        case export, importConfig
    }

    let mode: Mode
    let onExport: (String) -> Void
    let onImport: (String, String) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var cipherText = ""
    @State private var hint = ""
    @State private var errorMessage: String?

    private var isExport: Bool { mode == .export }
    private var canSubmit: Bool {
        if isExport {
            return !password.isEmpty && password == confirmPassword
        } else {
            return !cipherText.isEmpty && !password.isEmpty
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if isExport {
                        exportBody
                    } else {
                        importBody
                    }

                    if let errorMessage {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundStyle(.red)
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                        .padding(8)
                        .background(Color.red.opacity(0.08))
                        .cornerRadius(8)
                    }
                }
                .padding()
            }
            Divider()
            footer
        }
        .frame(width: 480, height: isExport ? 420 : 480)
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: isExport ? "lock.shield" : "lock.open")
                .font(.title3)
                .foregroundStyle(.purple)
            VStack(alignment: .leading, spacing: 2) {
                Text(isExport ? "加密导出配置" : "解密导入配置")
                    .font(.headline)
                Text(isExport
                     ? "设置密码并导出加密后的配置文本"
                     : "粘贴加密文本并输入密码以还原配置")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.borderless)
        }
        .padding()
    }

    // MARK: - Export Body

    private var exportBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("密码")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                SecureField("设置导出密码", text: $password)
                    .textFieldStyle(.roundedBorder)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("确认密码")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                SecureField("再次输入密码", text: $confirmPassword)
                    .textFieldStyle(.roundedBorder)
            }

            if !password.isEmpty && password != confirmPassword {
                Text("两次输入的密码不一致")
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("提示语（可选）")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                TextField("例如：主工作电脑配置", text: $hint)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    // MARK: - Import Body

    private var importBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("加密文本")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                TextEditor(text: $cipherText)
                    .font(.system(.caption, design: .monospaced))
                    .frame(minHeight: 120)
                    .padding(4)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("密码")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                SecureField("输入解密密码", text: $password)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            Button("取消") { dismiss() }
                .keyboardShortcut(.cancelAction)
            Spacer()
            Button(action: submit) {
                Label(isExport ? "导出到剪贴板" : "解密并导入", systemImage: isExport ? "square.and.arrow.up" : "square.and.arrow.down")
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmit)
        }
        .padding()
    }

    // MARK: - Actions

    private func submit() {
        errorMessage = nil
        if isExport {
            onExport(password)
            dismiss()
        } else {
            onImport(cipherText, password)
        }
    }

    func showError(_ message: String) {
        errorMessage = message
    }
}
