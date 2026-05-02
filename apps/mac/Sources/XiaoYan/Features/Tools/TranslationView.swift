import SwiftUI

/// 学术翻译面板。1:1 desktop `TranslationPanel.tsx:20-35`
/// 支持多语言对与自动识别。
struct TranslationView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var outputText = ""
    @State private var isTranslating = false
    @State private var sourceLang = "auto"
    @State private var targetLang = "zh"

    private static let languages = [
        ("自动识别", "auto"),
        ("中文", "zh"),
        ("英文", "en"),
        ("日文", "ja"),
        ("德文", "de"),
        ("法文", "fr"),
    ]

    private var languageName: (String) -> String {
        { code in
            Self.languages.first { $0.1 == code }?.0 ?? code
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                HStack(spacing: 8) {
                    Picker("源语言", selection: $sourceLang) {
                        ForEach(Self.languages, id: \.1) { name, code in
                            Text(name).tag(code)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 120)

                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Picker("目标语言", selection: $targetLang) {
                        ForEach(Self.languages.dropFirst(), id: \.1) { name, code in
                            Text(name).tag(code)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 120)
                }

                Spacer()

                Button(action: translate) {
                    if isTranslating {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("翻译")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isTranslating)
            }
            .padding()

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(languageName(sourceLang))原文")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextEditor(text: $inputText)
                        .font(.body)
                        .padding(4)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(languageName(targetLang))译文")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        if !outputText.isEmpty {
                            Button("复制") {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(outputText, forType: .string)
                            }
                            .font(.caption)
                        }
                    }
                    TextEditor(text: .constant(outputText))
                        .font(.body)
                        .padding(4)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                }
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
    }

    private func translate() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isTranslating = true
        outputText = ""

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["translation_model", "copilot_simple_model"],
                temperatureKeys: ["translation_temperature", "copilot_simple_temperature"]
            )

            guard let client else {
                outputText = "请先在设置中配置 LLM 提供商。"
                isTranslating = false
                return
            }

            let sourceName = languageName(sourceLang)
            let targetName = languageName(targetLang)
            let systemPrompt = """
            你是学术翻译专家。将以下\(sourceName)文本翻译为准确、流畅的\(targetName)，保持学术术语的专业性。\
            如果源语言为"自动识别"，请根据文本内容自行判断源语言。
            直接返回翻译结果，不要添加解释。
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: inputText)],
                    systemPrompt: systemPrompt
                )
                outputText = response
            } catch {
                outputText = "翻译失败: \(error.localizedDescription)"
            }
            isTranslating = false
        }
    }
}
