import SwiftUI
import UniformTypeIdentifiers

private struct MarkdownProgress {
    let current: Int
    let total: Int
    var fraction: Double {
        guard total > 0 else { return 0 }
        return Double(current) / Double(total)
    }
}

struct MarkdownFormatterView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var resultText = ""
    @State private var isProcessing = false
    @State private var errorMessage: String?
    @State private var progress: MarkdownProgress?
    @State private var showingFileImporter = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Markdown 整理")
                        .font(.headline)
                    Text("粘贴任意文本，小妍帮你整理为规范的 Markdown 格式。内容过长时会自动分块处理，保证全文一致性。")
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
                    Button {
                        showingFileImporter = true
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "plus")
                            Text("上传文件")
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
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
                if isProcessing, let prog = progress {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("正在处理第 \(prog.current) / \(prog.total) 块")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(Int(round(prog.fraction * 100)))%")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ProgressView(value: prog.fraction)
                            .progressViewStyle(.linear)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    Spacer()
                }

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
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: [UTType.plainText, UTType.text]
        ) { result in
            if case .success(let url) = result {
                Task {
                    if let content = try? String(contentsOf: url, encoding: .utf8) {
                        await MainActor.run { inputText = content }
                    }
                }
            }
        }
    }

    // MARK: - Formatting

    private func formatMarkdown() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isProcessing = true
        errorMessage = nil
        resultText = ""
        progress = nil

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

            let chunks = splitIntoChunks(inputText, maxLength: 1500)
            progress = MarkdownProgress(current: 0, total: chunks.count)

            var styleSummary = ""
            var parts: [String] = []

            do {
                for (index, chunk) in chunks.enumerated() {
                    progress = MarkdownProgress(current: index + 1, total: chunks.count)

                    let systemPrompt = buildSystemPrompt(styleSummary: styleSummary)
                    let response = try await client.chat(
                        messages: [LLMClient.Message(role: "user", content: chunk)],
                        systemPrompt: systemPrompt
                    )
                    parts.append(response)

                    if styleSummary.isEmpty {
                        styleSummary = try await generateStyleSummary(
                            from: response,
                            client: client
                        )
                    }
                }
                resultText = parts.joined(separator: "\n\n")
            } catch {
                errorMessage = "整理失败: \(error.localizedDescription)"
            }
            isProcessing = false
            progress = nil
        }
    }

    private func splitIntoChunks(_ text: String, maxLength: Int) -> [String] {
        let paragraphs = text.components(separatedBy: "\n\n")
        var chunks: [String] = []
        var currentChunk = ""
        for paragraph in paragraphs {
            if currentChunk.count + paragraph.count > maxLength && !currentChunk.isEmpty {
                chunks.append(currentChunk.trimmingCharacters(in: .whitespaces))
                currentChunk = paragraph
            } else {
                currentChunk = currentChunk.isEmpty ? paragraph : "\(currentChunk)\n\n\(paragraph)"
            }
        }
        let trimmed = currentChunk.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            chunks.append(trimmed)
        }
        return chunks
    }

    private func buildSystemPrompt(styleSummary: String) -> String {
        var prompt = """
        你是一位 Markdown 格式整理专家。请将用户提供的文本整理为规范、整洁的 Markdown 格式。
        要求：
        - 保持原文的核心内容和语义不变
        - 使用合适的标题层级、列表、引用等 Markdown 语法
        - 段落之间保留适当的空行
        - 代码块使用 ``` 包裹并标注语言
        - 输出纯 Markdown 文本，不要添加解释性文字
        """
        if !styleSummary.isEmpty {
            prompt += "\n\n已确定的统一风格：\n\(styleSummary)\n\n请严格保持与上述风格一致。"
        }
        return prompt
    }

    private func generateStyleSummary(from formatted: String, client: LLMClient) async throws -> String {
        let prompt = """
        请用一句话总结以下 Markdown 文本的风格特征（标题层级偏好、列表格式、段落间距、引用风格等），供后续段落保持统一风格使用。只输出总结，不要输出其他内容。

        \(String(formatted.prefix(500)))
        """
        let summary = try await client.chat(
            messages: [LLMClient.Message(role: "user", content: prompt)],
            systemPrompt: "你是一位风格分析专家。"
        )
        return summary.trimmingCharacters(in: .whitespacesAndNewlines)
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
