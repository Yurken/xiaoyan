import SwiftUI
import UniformTypeIdentifiers

struct MarkdownFormatterView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var resultText = ""
    @State private var isProcessing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Markdown 整理")
                        .font(.headline)
                    Text("粘贴任意文本，小妍帮你整理为规范的 Markdown 格式")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding()

            Divider()

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("待整理内容")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if !inputText.isEmpty {
                        Text("\(inputText.count) 字 · 预计 \(max(1, Int(ceil(Double(inputText.count) / 1500.0)))) 块")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                TextEditor(text: $inputText)
                    .font(.body)
                    .padding(4)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                    .frame(minHeight: 120)
            }
            .padding()

            HStack {
                Spacer()
                Button(action: formatMarkdown) {
                    if isProcessing {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("整理中…")
                        }
                    } else {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.text")
                            Text("开始整理")
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isProcessing)
            }
            .padding(.horizontal)

            if let error = errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                    Spacer()
                }
                .padding(8)
                .background(Color.red.opacity(0.08))
                .cornerRadius(8)
                .padding(.horizontal)
            }

            if !resultText.isEmpty {
                Divider().padding(.vertical, 8)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("整理结果")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("复制") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(resultText, forType: .string)
                        }
                        .font(.caption)
                        Button("保存为 .md") {
                            saveResult()
                        }
                        .font(.caption)
                    }
                    TextEditor(text: .constant(resultText))
                        .font(.system(.body, design: .monospaced))
                        .padding(4)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                        .frame(minHeight: 120)
                }
                .padding()
            }

            Spacer()
        }
    }

    private func formatMarkdown() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isProcessing = true
        errorMessage = nil
        resultText = ""

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                errorMessage = "请先在设置中配置 LLM 提供商。"
                isProcessing = false
                return
            }

            let systemPrompt = """
            你是一位 Markdown 格式整理专家。请将用户提供的文本整理为规范、整洁的 Markdown 格式。
            要求：
            - 保持原文的核心内容和语义不变
            - 使用合适的标题层级、列表、引用等 Markdown 语法
            - 段落之间保留适当的空行
            - 代码块使用 ``` 包裹并标注语言
            - 输出纯 Markdown 文本，不要添加解释性文字
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: inputText)],
                    systemPrompt: systemPrompt
                )
                resultText = response
            } catch {
                errorMessage = "整理失败: \(error.localizedDescription)"
            }
            isProcessing = false
        }
    }

    private func saveResult() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType.plainText]
        panel.nameFieldStringValue = "整理结果.md"
        panel.begin { result in
            if result == .OK, let url = panel.url {
                try? resultText.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }
}
