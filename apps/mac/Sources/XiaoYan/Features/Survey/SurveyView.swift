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
    @State private var structuredResult: StructuredSurveyResult?
    @State private var agents: [SurveyAgentState] = []
    @State private var activeTab: Tab = .report
    @State private var surveyHistory: [SurveyRecord] = []
    @State private var surveyContent: String = ""

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

                    // Agent flow
                    if !agents.isEmpty || isGenerating {
                        agentFlowSection
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
                            papersView(structuredResult?.papers ?? [])
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

    private var agentFlowSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("多能力域模型协作流程")
                    .font(.subheadline.bold())
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(agents) { agent in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(agent.name)
                                    .font(.caption.bold())
                                Text(agent.role)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            AgentStatusBadge(status: agent.status)
                        }
                        if let summary = agent.summary, !summary.isEmpty {
                            Text(summary)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        if let error = agent.error, !error.isEmpty {
                            Text(error)
                                .font(.caption2)
                                .foregroundStyle(.red)
                        }
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

    private func papersView(_ papers: [SurveyPaperEx]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if papers.isEmpty {
                Text("暂无检索到论文")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                ForEach(Array(papers.enumerated()), id: \.offset) { idx, paper in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .top, spacing: 6) {
                            Text("[\(idx + 1)]")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            Text(paper.title)
                                .font(.subheadline.bold())
                        }
                        HStack(spacing: 8) {
                            Text(paper.authors ?? "未知作者")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let year = paper.year, year > 0 {
                                BadgeView(text: "\(year)", color: .blue)
                            }
                            if let venue = paper.venue, !venue.isEmpty {
                                BadgeView(text: venue, color: .secondary)
                            }
                        }
                        if let abstract = paper.abstract, !abstract.isEmpty {
                            Text(abstract)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        if let doi = paper.doi, !doi.isEmpty {
                            Text("DOI: \(doi)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
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
        structuredResult = nil
        agents = []
        surveyContent = ""

        let service = SurveyService()
        service.delegate = self

        let currentYear = Calendar.current.component(.year, from: Date())
        let yearFrom: Int? = {
            switch timeRange {
            case "1y": return currentYear - 1
            case "3y": return currentYear - 3
            case "5y": return currentYear - 5
            case "10y": return currentYear - 10
            default: return nil
            }
        }()

        service.generate(
            query: scope.isEmpty ? topic : "\(topic) — \(scope)",
            settings: settings.settings,
            timeRange: timeRange,
            documentType: documentType,
            database: database,
            citationFormat: citationFormat,
            language: language,
            maxPapers: 20,
            yearFrom: yearFrom,
            yearTo: nil
        )
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

private struct AgentStatusBadge: View {
    let status: SurveyAgentStatus

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

// MARK: - SurveyServiceDelegate

extension SurveyView: SurveyServiceDelegate {
    func surveyService(_ service: SurveyService, agentDidStart agent: SurveyAgentState) {
        agents.append(agent)
    }

    func surveyService(_ service: SurveyService, agentDidComplete agent: SurveyAgentState) {
        if let idx = agents.firstIndex(where: { $0.id == agent.id }) {
            agents[idx] = agent
        }
    }

    func surveyService(_ service: SurveyService, agentDidFail agent: SurveyAgentState) {
        if let idx = agents.firstIndex(where: { $0.id == agent.id }) {
            agents[idx] = agent
        }
    }

    func surveyService(_ service: SurveyService, didReceiveDelta delta: String) {
        surveyContent += delta
    }

    func surveyService(_ service: SurveyService, didProduceStructured structured: StructuredSurveyResult) {
        structuredResult = structured
        result = convertToSurveyResult(structured)
        if !surveyContent.isEmpty {
            surveyHistory.insert(SurveyRecord(topic: topic, content: surveyContent, date: Date()), at: 0)
        }
    }

    func surveyServiceDidFinish(_ service: SurveyService) {
        isGenerating = false
    }

    func surveyService(_ service: SurveyService, didFailWithError error: String) {
        errorMessage = error
        isGenerating = false
    }

    private func convertToSurveyResult(_ structured: StructuredSurveyResult) -> SurveyResult {
        SurveyResult(
            query: structured.query,
            background: structured.report.background,
            methods: (structured.report.majorMethods ?? []).map {
                SurveyMethod(
                    category: $0.name ?? "",
                    description: $0.description ?? "",
                    strengths: $0.pros ?? "",
                    weaknesses: $0.cons ?? ""
                )
            },
            trends: (structured.report.researchTrends ?? []).map {
                SurveyTrend(trend: $0.trend ?? "", description: $0.signal ?? "")
            },
            gaps: structured.report.researchGaps ?? [],
            directions: (structured.report.futureDirections ?? []).map {
                SurveyDirection(direction: $0, rationale: "")
            },
            keyTakeaways: structured.report.overallSummary,
            papers: structured.papers.map {
                SurveyPaper(
                    title: $0.title,
                    authors: $0.authors ?? "",
                    year: $0.year ?? 0,
                    abstract: $0.abstract ?? "",
                    venue: $0.venue ?? ""
                )
            }
        )
    }
}
