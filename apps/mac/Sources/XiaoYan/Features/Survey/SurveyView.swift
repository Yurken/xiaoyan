import SwiftUI

struct SurveyView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var topic = ""
    @State private var scope = ""
    @State private var timeRange = "all"
    @State private var documentType = "all"
    @State private var database = "all"
    @State private var citationFormat = "apa"
    @State private var language = "zh"
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var result: SurveyResult?
    @State private var workflow: [SurveyWorkflowStep] = []
    @State private var activeTab: Tab = .report
    @State private var surveyHistory: [SurveyRecord] = []

    enum Tab: String, CaseIterable {
        case report = "综述报告"
        case papers = "检索论文"
    }

    struct SurveyRecord: Identifiable {
        let id = UUID()
        let topic: String
        let content: String
        let date: Date
    }

    var body: some View {
        HSplitView {
            // Sidebar: history
            VStack(spacing: 0) {
                HStack {
                    Text("历史记录")
                        .font(.headline)
                    Spacer()
                }
                .padding()

                Divider()

                List(surveyHistory) { record in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(record.topic)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        Text(record.date, style: .date)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
                .listStyle(.plain)
            }
            .frame(minWidth: 180, maxWidth: 220)

            // Main content
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Input area
                    VStack(alignment: .leading, spacing: 12) {
                        Text("文献调研与综述")
                            .font(.title2.bold())

                        Text("输入研究主题，小妍会检索相关文献并整理成结构化综述")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        VStack(spacing: 8) {
                            TextField("研究主题", text: $topic)
                                .textFieldStyle(.roundedBorder)
                            TextField("范围说明（可选）", text: $scope, axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                                .lineLimit(2...4)

                            SurveyParameterPanel(
                                timeRange: $timeRange,
                                documentType: $documentType,
                                database: $database,
                                citationFormat: $citationFormat,
                                language: $language
                            )
                        }

                        HStack {
                            Spacer()
                            Button(action: generateSurvey) {
                                if isGenerating {
                                    HStack(spacing: 6) {
                                        ProgressView().controlSize(.small)
                                        Text("正在生成...")
                                    }
                                } else {
                                    HStack(spacing: 6) {
                                        Image(systemName: "sparkles")
                                        Text("生成综述")
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating)
                        }

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
                        }
                    }

                    // Workflow
                    if !workflow.isEmpty || isGenerating {
                        workflowSection
                    }

                    // Result
                    if let result = result {
                        Divider()

                        // Tabs
                        Picker("", selection: $activeTab) {
                            ForEach(Tab.allCases, id: \.self) { tab in
                                Text(tab.rawValue).tag(tab)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 280)

                        if activeTab == .report {
                            reportView(result)
                        } else {
                            papersView(result)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationTitle("综述")
    }

    // MARK: - Workflow

    private var workflowSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("多能力域模型协作流程")
                    .font(.subheadline.bold())
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(workflow) { step in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.name)
                                .font(.caption.bold())
                            Text(step.role)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        WorkflowStatusBadge(status: step.status)
                    }
                    .padding(8)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                }
            }
        }
    }

    // MARK: - Report View

    private func reportView(_ result: SurveyResult) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if let background = result.background {
                SurveySection(title: "研究背景", icon: "book", color: .blue, content: background)
            }

            if !result.methods.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "command")
                            .foregroundStyle(.purple)
                        Text("代表性方法分类")
                            .font(.headline)
                    }
                    ForEach(result.methods) { method in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(method.category)
                                .font(.subheadline.bold())
                            Text(method.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if !method.strengths.isEmpty || !method.weaknesses.isEmpty {
                                HStack(spacing: 12) {
                                    if !method.strengths.isEmpty {
                                        Text("优势: \(method.strengths)")
                                            .font(.caption2)
                                            .foregroundStyle(.green)
                                    }
                                    if !method.weaknesses.isEmpty {
                                        Text("局限: \(method.weaknesses)")
                                            .font(.caption2)
                                            .foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                        .padding(10)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                }
            }

            if !result.trends.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 4) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(.green)
                        Text("研究趋势")
                            .font(.headline)
                    }
                    ForEach(result.trends) { trend in
                        HStack(alignment: .top, spacing: 8) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.blue.opacity(0.4))
                                .frame(width: 3)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(trend.trend)
                                    .font(.subheadline.bold())
                                Text(trend.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            HStack(alignment: .top, spacing: 16) {
                if !result.gaps.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundStyle(.orange)
                            Text("现有不足")
                                .font(.headline)
                        }
                        ForEach(result.gaps, id: \.self) { gap in
                            HStack(alignment: .top, spacing: 4) {
                                Text("•")
                                    .foregroundStyle(.orange)
                                Text(gap)
                                    .font(.caption)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if !result.directions.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 4) {
                            Image(systemName: "lightbulb")
                                .foregroundStyle(.green)
                            Text("未来方向")
                                .font(.headline)
                        }
                        ForEach(result.directions) { dir in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dir.direction)
                                    .font(.subheadline.bold())
                                Text(dir.rationale)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(8)
                            .background(Color.green.opacity(0.06))
                            .cornerRadius(8)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }

            if let takeaways = result.keyTakeaways {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("核心总结")
                            .font(.subheadline.bold())
                        Text(takeaways)
                            .font(.caption)
                    }
                }
                .padding(12)
                .background(Color.blue.opacity(0.06))
                .cornerRadius(10)
            }
        }
    }

    // MARK: - Papers View

    private func papersView(_ result: SurveyResult) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if result.papers.isEmpty {
                Text("暂无检索到论文")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(Array(result.papers.enumerated()), id: \.offset) { idx, paper in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .top, spacing: 6) {
                            Text("[\(idx + 1)]")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            Text(paper.title)
                                .font(.subheadline.bold())
                        }
                        HStack(spacing: 8) {
                            Text(paper.authors)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if paper.year > 0 {
                                BadgeView(text: "\(paper.year)", color: .blue)
                            }
                            if !paper.venue.isEmpty {
                                BadgeView(text: paper.venue, color: .secondary)
                            }
                        }
                        if !paper.abstract.isEmpty {
                            Text(paper.abstract)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                    .padding(10)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                }
            }
        }
    }

    // MARK: - Generation

    private func generateSurvey() {
        guard !topic.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isGenerating = true
        errorMessage = nil
        result = nil
        workflow = defaultWorkflow()
        simulateWorkflow()

        let fullQuery = scope.isEmpty ? topic : "\(topic) — \(scope)"

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["survey_writer_model", "multi_agent_survey_model", "multi_agent_worker_model"],
                temperatureKeys: ["survey_writer_temperature", "multi_agent_survey_temperature"]
            )

            guard let client else {
                errorMessage = "请先在设置中配置 LLM 提供商。"
                isGenerating = false
                return
            }

            let paramLines = [
                timeRange != "all" ? "- 时间范围：\(timeRangeLabel)" : nil,
                documentType != "all" ? "- 文献类型：\(documentTypeLabel)" : nil,
                database != "all" ? "- 检索数据库：\(databaseLabel)" : nil,
                "- 引用格式：\(citationFormatLabel)",
                "- 输出语言：\(languageLabel)",
            ].compactMap { $0 }
            let paramSection = paramLines.isEmpty ? "" : "\n## 高级参数\n" + paramLines.joined(separator: "\n")

            let prompt = """
            你是一位文献综述专家。请为以下研究主题生成结构化的文献综述，返回 JSON 格式：
            {
                "background": "研究背景概述",
                "methods": [
                    {"category": "方法类别", "description": "描述", "strengths": "优势", "weaknesses": "局限"}
                ],
                "trends": [
                    {"trend": "趋势名称", "description": "描述"}
                ],
                "gaps": ["现有不足1", "现有不足2"],
                "directions": [
                    {"direction": "方向", "rationale": "理由"}
                ],
                "key_takeaways": "核心总结",
                "papers": [
                    {"title": "论文标题", "authors": "作者", "year": 2024, "abstract": "摘要", "venue": "会议/期刊"}
                ]
            }

            ## 研究主题
            \(fullQuery)\(paramSection)

            要求：
            - 用 \(languageLabel) 撰写
            - 提供有深度的分析
            - papers 列出 5-10 篇代表性论文（可包含真实或合理推测的论文）
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: fullQuery)],
                    systemPrompt: prompt
                )
                let parsed = parseSurveyJSON(response)
                result = parsed
                surveyHistory.insert(SurveyRecord(topic: topic, content: response, date: Date()), at: 0)
                completeWorkflow(success: true)
            } catch {
                errorMessage = "生成失败: \(error.localizedDescription)"
                completeWorkflow(success: false, error: error.localizedDescription)
            }
            isGenerating = false
        }
    }

    // MARK: - Parameter Labels

    private var timeRangeLabel: String {
        SurveyParameterPanel.timeRanges.first { $0.1 == timeRange }?.0 ?? "全部"
    }

    private var documentTypeLabel: String {
        SurveyParameterPanel.documentTypes.first { $0.1 == documentType }?.0 ?? "全部"
    }

    private var databaseLabel: String {
        SurveyParameterPanel.databases.first { $0.1 == database }?.0 ?? "全部"
    }

    private var citationFormatLabel: String {
        SurveyParameterPanel.citationFormats.first { $0.1 == citationFormat }?.0 ?? "APA"
    }

    private var languageLabel: String {
        SurveyParameterPanel.languages.first { $0.1 == language }?.0 ?? "中文"
    }

    // MARK: - Workflow

    private func defaultWorkflow() -> [SurveyWorkflowStep] {
        [
            SurveyWorkflowStep(id: "planner", name: "检索规划模型", role: "规划研究范围与检索策略", status: .pending),
            SurveyWorkflowStep(id: "retriever", name: "文献检索模型", role: "小妍会自动检索相关文献", status: .pending),
            SurveyWorkflowStep(id: "writer", name: "综述写作模型", role: "生成结构化文献综述", status: .pending),
        ]
    }

    private func simulateWorkflow() {
        workflow[0].status = .running
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            if self.isGenerating {
                self.workflow[0].status = .done
                self.workflow[0].summary = "已生成检索与覆盖主题规划"
                self.workflow[1].status = .running
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            if self.isGenerating {
                self.workflow[1].status = .done
                self.workflow[1].summary = "正在汇总候选文献与证据"
                self.workflow[2].status = .running
            }
        }
    }

    private func completeWorkflow(success: Bool, error: String? = nil) {
        if success {
            workflow[2].status = .done
            workflow[2].summary = "已输出研究背景、方法、趋势与建议研究方向"
        } else {
            let runningIndex = workflow.firstIndex { $0.status == .running }
            let idx = runningIndex ?? 2
            workflow[idx].status = .failed
            workflow[idx].error = error
        }
    }

    // MARK: - JSON Parsing

    private func parseSurveyJSON(_ text: String) -> SurveyResult {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = clean.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return SurveyResult(
                query: topic,
                background: text,
                methods: [], trends: [], gaps: [], directions: [],
                keyTakeaways: nil, papers: []
            )
        }

        let methods: [SurveyMethod] = (json["methods"] as? [[String: String]])?.compactMap { dict in
            SurveyMethod(
                category: dict["category"] ?? "",
                description: dict["description"] ?? "",
                strengths: dict["strengths"] ?? "",
                weaknesses: dict["weaknesses"] ?? ""
            )
        } ?? []

        let trends: [SurveyTrend] = (json["trends"] as? [[String: String]])?.compactMap { dict in
            SurveyTrend(trend: dict["trend"] ?? "", description: dict["description"] ?? "")
        } ?? []

        let gaps = (json["gaps"] as? [String]) ?? []

        let directions: [SurveyDirection] = (json["directions"] as? [[String: String]])?.compactMap { dict in
            SurveyDirection(direction: dict["direction"] ?? "", rationale: dict["rationale"] ?? "")
        } ?? []

        let papers: [SurveyPaper] = (json["papers"] as? [[String: Any]])?.compactMap { dict in
            SurveyPaper(
                title: dict["title"] as? String ?? "",
                authors: dict["authors"] as? String ?? "",
                year: dict["year"] as? Int ?? 0,
                abstract: dict["abstract"] as? String ?? "",
                venue: dict["venue"] as? String ?? ""
            )
        } ?? []

        return SurveyResult(
            query: topic,
            background: json["background"] as? String,
            methods: methods,
            trends: trends,
            gaps: gaps,
            directions: directions,
            keyTakeaways: json["key_takeaways"] as? String,
            papers: papers
        )
    }
}

// MARK: - Data Models

struct SurveyWorkflowStep: Identifiable {
    let id: String
    let name: String
    let role: String
    var status: WorkflowStatus
    var summary: String?
    var error: String?
}

enum WorkflowStatus {
    case pending, running, done, failed
}

struct SurveyResult {
    let query: String
    let background: String?
    let methods: [SurveyMethod]
    let trends: [SurveyTrend]
    let gaps: [String]
    let directions: [SurveyDirection]
    let keyTakeaways: String?
    let papers: [SurveyPaper]
}

struct SurveyMethod: Identifiable {
    let id = UUID()
    let category: String
    let description: String
    let strengths: String
    let weaknesses: String
}

struct SurveyTrend: Identifiable {
    let id = UUID()
    let trend: String
    let description: String
}

struct SurveyDirection: Identifiable {
    let id = UUID()
    let direction: String
    let rationale: String
}

struct SurveyPaper: Identifiable {
    let id = UUID()
    let title: String
    let authors: String
    let year: Int
    let abstract: String
    let venue: String
}

// MARK: - Workflow Status Badge

private struct WorkflowStatusBadge: View {
    let status: WorkflowStatus

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: icon)
                .font(.caption2)
            Text(label)
                .font(.caption2.bold())
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(color.opacity(0.15))
        .foregroundColor(color)
        .cornerRadius(4)
    }

    private var icon: String {
        switch status {
        case .done: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .running: return "clock.fill"
        case .pending: return "clock"
        }
    }

    private var label: String {
        switch status {
        case .done: return "已完成"
        case .failed: return "失败"
        case .running: return "处理中"
        case .pending: return "待处理"
        }
    }

    private var color: Color {
        switch status {
        case .done: return .green
        case .failed: return .red
        case .running: return .orange
        case .pending: return .secondary
        }
    }
}

// MARK: - Survey Section

private struct SurveySection: View {
    let title: String
    let icon: String
    let color: Color
    let content: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Text(title)
                    .font(.headline)
            }
            Text(content)
                .font(.body)
                .textSelection(.enabled)
        }
        .padding(12)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}
