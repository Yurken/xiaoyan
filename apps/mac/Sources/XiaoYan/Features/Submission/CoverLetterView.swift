import SwiftUI

struct CoverLetterView: View {
    let service: SubmissionService
    @EnvironmentObject var settings: AppSettings
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var paperAbstract = ""
    @State private var highlight = ""
    @State private var result = ""
    @State private var isGenerating = false
    @State private var mode: Mode = .coverLetter

    enum Mode: String, CaseIterable {
        case coverLetter = "Cover Letter"
        case polish = "润色"
    }

    var body: some View {
        HSplitView {
            // Sidebar
            VStack(spacing: 0) {
                HStack {
                    Text("选择投稿")
                        .font(.headline)
                    Spacer()
                }
                .padding()

                Divider()

                List(submissions, selection: $selectedSubmission) { sub in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(sub.title)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        if let venue = sub.venueName {
                            Text(venue)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                    .tag(sub)
                }
                .listStyle(.plain)
            }
            .frame(minWidth: 200, maxWidth: 260)

            // Main
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 12) {
                        Image(systemName: mode == .coverLetter ? "envelope" : "pencil")
                            .font(.title2)
                            .foregroundStyle(.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(mode == .coverLetter ? "Cover Letter 生成" : "论文润色")
                                .font(.title2.bold())
                            Text(mode == .coverLetter ? "基于论文信息自动生成投稿信" : "提升论文语言表达与学术规范性")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Picker("模式", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { m in
                            Text(m.rawValue).tag(m)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)

                    if let sub = selectedSubmission {
                        Text("投稿: \(sub.title)")
                            .font(.subheadline.bold())
                            .foregroundStyle(.blue)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("论文摘要 / 核心内容")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextEditor(text: $paperAbstract)
                            .font(.body)
                            .frame(minHeight: 120)
                            .padding(4)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                    }

                    if mode == .coverLetter {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("亮点 / 贡献总结（可选）")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextEditor(text: $highlight)
                                .font(.body)
                                .frame(minHeight: 60)
                                .padding(4)
                                .background(Theme.Colors.surface)
                                .cornerRadius(Theme.Radii.medium)
                                .nmShadow(level: Theme.Shadows.soft)
                        }
                    }

                    HStack {
                        Spacer()
                        Button(action: generate) {
                            if isGenerating {
                                HStack(spacing: 6) {
                                    ProgressView().controlSize(.small)
                                    Text("生成中...")
                                }
                            } else {
                                HStack(spacing: 6) {
                                    Image(systemName: "sparkles")
                                    Text(mode == .coverLetter ? "生成 Cover Letter" : "开始润色")
                                }
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(paperAbstract.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating)
                    }

                    if !result.isEmpty {
                        Divider()

                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("结果")
                                    .font(.headline)
                                Spacer()
                                Button("复制") {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(result, forType: .string)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                            TextEditor(text: .constant(result))
                                .font(.body)
                                .frame(minHeight: 200)
                                .padding(4)
                                .background(Theme.Colors.surface)
                                .cornerRadius(Theme.Radii.medium)
                                .nmShadow(level: Theme.Shadows.soft)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .onAppear(perform: reload)
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func generate() {
        guard !paperAbstract.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isGenerating = true
        result = ""

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                result = "请先在设置中配置 LLM 提供商。"
                isGenerating = false
                return
            }

            let systemPrompt: String
            let content: String

            if mode == .coverLetter {
                let venue = selectedSubmission?.venueName ?? "贵刊/会议"
                systemPrompt = """
                你是一位学术投稿专家。请根据论文信息，撰写一封专业、简洁的 Cover Letter（投稿信）。
                投稿目标: \(venue)
                要求：
                - 英文撰写
                - 包含研究背景、核心贡献、与目标刊会的契合点
                - 语气专业、礼貌
                - 控制在 300-500 词
                """
                content = """
                论文摘要: \(paperAbstract)
                \(highlight.isEmpty ? "" : "亮点: \(highlight)")
                """
            } else {
                systemPrompt = """
                你是一位学术写作编辑。请对以下论文文本进行润色，提升其语言表达与学术规范性。
                要求：
                - 保持原文的核心内容和语义不变
                - 修正语法错误、不自然的表达
                - 提升学术英语的正式性和流畅度
                - 直接输出润色后的文本，不要添加解释
                """
                content = paperAbstract
            }

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: content)],
                    systemPrompt: systemPrompt
                )
                result = response
            } catch {
                result = "生成失败: \(error.localizedDescription)"
            }
            isGenerating = false
        }
    }
}
