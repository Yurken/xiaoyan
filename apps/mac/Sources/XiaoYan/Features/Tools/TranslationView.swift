import SwiftUI

struct TranslationView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var outputText = ""
    @State private var isTranslating = false
    @State private var direction: Direction = .enToZh

    enum Direction: String, CaseIterable {
        case enToZh = "英 → 中"
        case zhToEn = "中 → 英"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("方向", selection: $direction) {
                    ForEach(Direction.allCases, id: \.self) { dir in
                        Text(dir.rawValue).tag(dir)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 150)

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
                    Text(direction == .enToZh ? "英文原文" : "中文原文")
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
                        Text(direction == .enToZh ? "中文译文" : "英文译文")
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
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                outputText = "请先在设置中配置 LLM 提供商。"
                isTranslating = false
                return
            }

            let systemPrompt: String
            switch direction {
            case .enToZh:
                systemPrompt = "你是学术翻译专家。将以下英文翻译为准确、流畅的中文，保持学术术语的专业性。"
            case .zhToEn:
                systemPrompt = "你是学术翻译专家。将以下中文翻译为准确、地道的英文，保持学术术语的专业性。"
            }

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
