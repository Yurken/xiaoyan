import SwiftUI

struct SurveyView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var topic = ""
    @State private var scope = ""
    @State private var isGenerating = false
    @State private var surveyResult = ""
    @State private var surveyHistory: [SurveyRecord] = []

    struct SurveyRecord: Identifiable {
        let id: String
        let topic: String
        let content: String
        let date: Date
    }

    var body: some View {
        HStack(spacing: 0) {
            // Sidebar: history
            VStack(spacing: 0) {
                List(surveyHistory, selection: .constant(nil as String?)) { record in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(record.topic)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        Text(record.date, style: .date)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                    .tag(record.id)
                }
                .listStyle(.sidebar)
            }
            .frame(width: 200)

            Divider()

            // Main content
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Input area
                    VStack(alignment: .leading, spacing: 12) {
                        Text("文献综述")
                            .font(.title2.bold())

                        Text("输入研究主题，AI 将为你生成结构化的文献综述")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        HStack(alignment: .top, spacing: 12) {
                            VStack(spacing: 8) {
                                TextField("研究主题", text: $topic)
                                    .textFieldStyle(.roundedBorder)
                                TextField("范围说明（可选）", text: $scope, axis: .vertical)
                                    .textFieldStyle(.roundedBorder)
                                    .lineLimit(2...4)
                            }

                            Button(action: generateSurvey) {
                                if isGenerating {
                                    ProgressView()
                                        .controlSize(.small)
                                } else {
                                    Text("生成综述")
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating)
                            .frame(width: 100)
                        }
                    }

                    if !surveyResult.isEmpty {
                        Divider()

                        // Result
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("综述结果")
                                    .font(.headline)
                                Spacer()
                                Button("复制") {
                                    NSPasteboard.general.clearContents()
                                    NSPasteboard.general.setString(surveyResult, forType: .string)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }

                            Text(surveyResult)
                                .font(.body)
                                .textSelection(.enabled)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(nsColor: .controlBackgroundColor))
                                .cornerRadius(8)
                        }
                    }

                    if isGenerating && surveyResult.isEmpty {
                        HStack {
                            Spacer()
                            VStack(spacing: 12) {
                                ProgressView()
                                Text("正在生成文献综述...")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 40)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationTitle("综述")
    }

    private func generateSurvey() {
        guard !topic.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isGenerating = true
        surveyResult = ""

        let fullQuery = scope.isEmpty ? topic : "\(topic) — \(scope)"

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["multi_agent_survey_model", "multi_agent_worker_model"],
                temperatureKeys: ["multi_agent_survey_temperature"]
            )

            guard let client else {
                surveyResult = "请先在设置中配置 LLM 提供商。"
                isGenerating = false
                return
            }

            let prompt = """
            你是一位文献综述专家。请为以下研究主题生成结构化的文献综述。

            ## 研究主题
            \(fullQuery)

            请按以下结构组织回复：
            1. 研究领域概述
            2. 关键研究方向与分类
            3. 代表性工作与里程碑
            4. 当前研究趋势
            5. 开放问题与未来展望

            要求：
            - 用中文撰写
            - 引用具体的研究方向和趋势
            - 提供有深度的分析
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: fullQuery)],
                    systemPrompt: prompt
                )
                surveyResult = response
                surveyHistory.insert(SurveyRecord(
                    id: UUID().uuidString,
                    topic: topic,
                    content: response,
                    date: Date()
                ), at: 0)
            } catch {
                surveyResult = "生成失败: \(error.localizedDescription)"
            }
            isGenerating = false
        }
    }
}
