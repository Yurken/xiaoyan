import SwiftUI
import UniformTypeIdentifiers

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

    @State private var interests: [ResearchInterest] = []
    @State private var selectedInterestId: String = ""
    @State private var interestPapers: [Paper] = []
    @State private var selectedPaperIds: [String] = []
    @State private var loadingPapers = false

    private let knowledgeService = KnowledgeService()
    private let paperRepo = PaperRepository()

    enum Tab: String, CaseIterable {
        case report = "综述报告"
        case papers = "检索论文"
    }

    struct SurveyRecord: Identifiable, Codable {
        let id: UUID
        let topic: String
        let content: String
        let date: Date

        init(id: UUID = UUID(), topic: String, content: String, date: Date) {
            self.id = id
            self.topic = topic
            self.content = content
            self.date = date
        }
    }

    var body: some View {
        HSplitView {
            // Sidebar: interests + papers + history
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if !interests.isEmpty {
                        HStack {
                            Text("研究方向")
                                .font(.headline)
                            Spacer()
                        }
                        .padding()

                        Divider()

                        VStack(spacing: 0) {
                            Button {
                                selectedInterestId = ""
                                selectedPaperIds = []
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.caption)
                                        .foregroundStyle(selectedInterestId.isEmpty ? .blue : .secondary)
                                    Text("自由检索")
                                        .font(.subheadline)
                                    Spacer()
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(selectedInterestId.isEmpty ? Color.blue.opacity(0.08) : Color.clear)
                            }
                            .buttonStyle(.plain)

                            ForEach(interests) { interest in
                                let isSelected = selectedInterestId == interest.id
                                Button {
                                    selectedInterestId = interest.id
                                    topic = interest.topic
                                } label: {
                                    HStack(spacing: 8) {
                                        Image(systemName: "folder")
                                            .font(.caption)
                                            .foregroundStyle(isSelected ? .blue : .secondary)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(interest.folderName?.trimmingCharacters(in: .whitespaces).isEmpty == false ? interest.folderName! : interest.topic)
                                                .font(.subheadline)
                                                .lineLimit(1)
                                            if let folder = interest.folderName?.trimmingCharacters(in: .whitespaces), !folder.isEmpty, folder != interest.topic {
                                                Text(interest.topic)
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                                    .lineLimit(1)
                                            }
                                        }
                                        Spacer()
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(isSelected ? Color.blue.opacity(0.08) : Color.clear)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if !selectedInterestId.isEmpty {
                            Divider()
                                .padding(.vertical, 4)

                            HStack {
                                Text("论文库")
                                    .font(.subheadline.bold())
                                if interestPapers.count > 0 {
                                    Text("(\(selectedPaperIds.count)/\(interestPapers.count))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if !interestPapers.isEmpty {
                                    Button(selectedPaperIds.count == interestPapers.count ? "取消全选" : "全选") {
                                        toggleAllPapers()
                                    }
                                    .font(.caption)
                                    .buttonStyle(.borderless)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.top, 4)

                            if loadingPapers {
                                HStack(spacing: 4) {
                                    ProgressView().controlSize(.small)
                                    Text("正在加载…")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.horizontal)
                                .padding(.vertical, 4)
                            } else if interestPapers.isEmpty {
                                Text("该研究方向下暂无论文")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal)
                                    .padding(.vertical, 4)
                            } else {
                                VStack(spacing: 0) {
                                    ForEach(interestPapers) { paper in
                                        let checked = selectedPaperIds.contains(paper.id)
                                        Button {
                                            togglePaper(paper.id)
                                        } label: {
                                            HStack(alignment: .top, spacing: 6) {
                                                Image(systemName: checked ? "checkmark.square.fill" : "square")
                                                    .font(.caption)
                                                    .foregroundStyle(checked ? .blue : .secondary)
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(paper.title)
                                                        .font(.caption)
                                                        .lineLimit(2)
                                                        .multilineTextAlignment(.leading)
                                                    if paper.year != nil || paper.venue != nil {
                                                        Text([paper.year.map(String.init), paper.venue].compactMap { $0 }.joined(separator: " · "))
                                                            .font(.caption2)
                                                            .foregroundStyle(.secondary)
                                                    }
                                                }
                                                Spacer()
                                            }
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 6)
                                            .background(checked ? Color.blue.opacity(0.05) : Color.clear)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                if selectedPaperIds.count > 0 && selectedPaperIds.count < interestPapers.count {
                                    Text("当前仅使用已勾选的 \(selectedPaperIds.count) 篇论文生成综述")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal)
                                        .padding(.top, 4)
                                }
                            }
                        }
                    }

                    if !surveyHistory.isEmpty {
                        Divider()
                            .padding(.vertical, 4)

                        HStack {
                            Text("历史记录")
                                .font(.headline)
                            Spacer()
                        }
                        .padding()

                        Divider()

                        ForEach(surveyHistory) { record in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(record.topic)
                                    .font(.subheadline.bold())
                                    .lineLimit(1)
                                Text(record.date, style: .date)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 4)
                        }
                    }
                }
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
                    if let structured = structuredResult {
                        Divider()

                        HStack {
                            Picker("", selection: $activeTab) {
                                ForEach(Tab.allCases, id: \.self) { tab in
                                    Text(tab.rawValue).tag(tab)
                                }
                            }
                            .pickerStyle(.segmented)
                            .frame(maxWidth: 280)

                            Spacer()

                            if !surveyContent.isEmpty {
                                Button(action: exportSurveyMarkdown) {
                                    Label("导出 Markdown", systemImage: "square.and.arrow.down")
                                }
                                .buttonStyle(.borderless)
                                .controlSize(.small)
                            }
                        }

                        if activeTab == .report {
                            reportView(structured)
                        } else {
                            papersView(structured.papers)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .navigationTitle("综述")
        .onAppear {
            loadHistory()
            loadInterests()
        }
        .onChange(of: selectedInterestId) { _, _ in
            loadInterestPapers()
        }
    }

    // MARK: - Interests & Papers

    private func loadInterests() {
        interests = knowledgeService.listInterests()
    }

    private func loadInterestPapers() {
        guard !selectedInterestId.isEmpty else {
            interestPapers = []
            selectedPaperIds = []
            return
        }
        loadingPapers = true
        do {
            interestPapers = try paperRepo.list(researchInterestId: selectedInterestId)
            selectedPaperIds = interestPapers.map { $0.id }
        } catch {
            interestPapers = []
            selectedPaperIds = []
        }
        loadingPapers = false
    }

    private func togglePaper(_ id: String) {
        if selectedPaperIds.contains(id) {
            selectedPaperIds.removeAll { $0 == id }
        } else {
            selectedPaperIds.append(id)
        }
    }

    private func toggleAllPapers() {
        if selectedPaperIds.count == interestPapers.count {
            selectedPaperIds = []
        } else {
            selectedPaperIds = interestPapers.map { $0.id }
        }
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

    private func reportView(_ structured: StructuredSurveyResult) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            sectionHeader("研究问题")
            Text(structured.query)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            backgroundSection(structured.report.background)
            timelineSection(structured.report)
            majorMethodsSection(structured.report.majorMethods)
            schoolsSection(structured.report.schoolsOfThought)
            methodologySummarySection(structured.report.methodologySummary)
            trendsSection(structured.report.researchTrends)
            controversiesSection(structured.report.controversies)
            challengesSection(structured.report.challenges)
            gapsSection(structured.report.researchGaps)
            futureDirectionsSection(structured.report.futureDirections)
            recommendedTopicsSection(structured.report.recommendedTopics)
            overallSummarySection(structured.report.overallSummary)
            citationsSection(structured.formattedCitations, format: structured.citationFormat)
        }
    }

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.caption.bold())
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
    }

    @ViewBuilder
    private func backgroundSection(_ background: String?) -> some View {
        if let background = background, !background.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                sectionHeader("研究背景")
                Text(background)
                    .font(.body)
                    .textSelection(.enabled)
            }
            .padding(12)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
        }
    }

    @ViewBuilder
    private func timelineSection(_ report: StructuredSurveyReport) -> some View {
        let timeline = report.developmentTimeline ?? []
        if !timeline.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("发展脉络")
                if let ep = report.earliestPeriod, !ep.isEmpty {
                    Text(ep)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .italic()
                }
                ForEach(Array(timeline.enumerated()), id: \.offset) { _, stage in
                    VStack(alignment: .leading, spacing: 4) {
                        if let period = stage.period, !period.isEmpty {
                            Text(period)
                                .font(.subheadline.bold())
                                .foregroundStyle(.blue)
                        }
                        if let milestone = stage.milestone, !milestone.isEmpty {
                            Text(milestone)
                                .font(.body)
                        }
                        if let works = stage.keyWorks, !works.isEmpty {
                            Text("代表工作：\(works.joined(separator: "、"))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let significance = stage.significance, !significance.isEmpty {
                            Text(significance)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(10)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                }
                if let cf = report.currentFrontier, !cf.isEmpty {
                    Text("当前前沿：\(cf)")
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .padding(10)
                        .background(Color.blue.opacity(0.06))
                        .cornerRadius(Theme.Radii.medium)
                }
            }
        }
    }

    @ViewBuilder
    private func majorMethodsSection(_ methods: [SurveyMethodEx]?) -> some View {
        if let methods = methods, !methods.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("主要方法")
                ForEach(Array(methods.enumerated()), id: \.offset) { _, method in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(method.name ?? "")
                            .font(.subheadline.bold())
                        if let desc = method.description, !desc.isEmpty {
                            Text(desc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if (method.pros != nil && !method.pros!.isEmpty) || (method.cons != nil && !method.cons!.isEmpty) {
                            HStack(spacing: 12) {
                                if let pros = method.pros, !pros.isEmpty {
                                    Text("优势：\(pros)")
                                        .font(.caption2)
                                        .foregroundStyle(.green)
                                }
                                if let cons = method.cons, !cons.isEmpty {
                                    Text("局限：\(cons)")
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                        if let papers = method.representativePapers, !papers.isEmpty {
                            Text("代表论文：\(papers.joined(separator: "、"))")
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

    @ViewBuilder
    private func schoolsSection(_ schools: [SurveySchool]?) -> some View {
        if let schools = schools, !schools.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("主要学派与流派")
                ForEach(Array(schools.enumerated()), id: \.offset) { _, school in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(school.name ?? "")
                            .font(.subheadline.bold())
                        if let desc = school.description, !desc.isEmpty {
                            Text(desc)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let reps = school.representatives, !reps.isEmpty {
                            Text("代表：\(reps.joined(separator: "、"))")
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

    @ViewBuilder
    private func methodologySummarySection(_ summary: SurveyMethodologySummary?) -> some View {
        if let summary = summary {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("研究方法总结")
                VStack(alignment: .leading, spacing: 6) {
                    if let mainstream = summary.mainstream, !mainstream.isEmpty {
                        Text("**主流：**\(mainstream)")
                            .font(.caption)
                    }
                    if let emerging = summary.emerging, !emerging.isEmpty {
                        Text("**新兴：**\(emerging)")
                            .font(.caption)
                    }
                    if let comparison = summary.comparison, !comparison.isEmpty {
                        Text("**对比：**\(comparison)")
                            .font(.caption)
                    }
                }
                .padding(10)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)
            }
        }
    }

    @ViewBuilder
    private func trendsSection(_ trends: [SurveyTrendEx]?) -> some View {
        if let trends = trends, !trends.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("研究趋势")
                ForEach(Array(trends.enumerated()), id: \.offset) { _, trend in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(trend.trend ?? "")
                            .font(.subheadline.bold())
                        if let signal = trend.signal, !signal.isEmpty {
                            Text(signal)
                                .font(.caption)
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

    @ViewBuilder
    private func controversiesSection(_ controversies: [SurveyControversy]?) -> some View {
        if let controversies = controversies, !controversies.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("研究争议")
                ForEach(Array(controversies.enumerated()), id: \.offset) { _, c in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(c.topic ?? "")
                            .font(.subheadline.bold())
                        if let positions = c.positions, !positions.isEmpty {
                            ForEach(Array(positions.enumerated()), id: \.offset) { _, pos in
                                HStack(alignment: .top, spacing: 4) {
                                    Text("•")
                                    Text(pos)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
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
    }

    @ViewBuilder
    private func challengesSection(_ challenges: [String]?) -> some View {
        if let challenges = challenges, !challenges.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("关键挑战")
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(challenges.enumerated()), id: \.offset) { _, challenge in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                            Text(challenge)
                                .font(.body)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func gapsSection(_ gaps: [String]?) -> some View {
        if let gaps = gaps, !gaps.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("研究缺口")
                ForEach(Array(gaps.enumerated()), id: \.offset) { idx, gap in
                    HStack(alignment: .top, spacing: 8) {
                        Text("\(idx + 1)")
                            .font(.caption2.bold())
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange)
                            .cornerRadius(4)
                        Text(gap)
                            .font(.body)
                    }
                    .padding(10)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                }
            }
        }
    }

    @ViewBuilder
    private func futureDirectionsSection(_ directions: [String]?) -> some View {
        if let directions = directions, !directions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("未来研究方向")
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(directions.enumerated()), id: \.offset) { _, dir in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                            Text(dir)
                                .font(.body)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func recommendedTopicsSection(_ topics: [SurveyRecommendedTopic]?) -> some View {
        if let topics = topics, !topics.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                sectionHeader("建议研究主题")
                let columns = [GridItem(.flexible()), GridItem(.flexible())]
                LazyVGrid(columns: columns, alignment: .leading, spacing: 10) {
                    ForEach(Array(topics.enumerated()), id: \.offset) { _, topic in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(topic.topic ?? "")
                                .font(.subheadline.bold())
                            if let why = topic.why, !why.isEmpty {
                                Text(why)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let step = topic.firstStep, !step.isEmpty {
                                Text("第一步：\(step)")
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
    }

    @ViewBuilder
    private func overallSummarySection(_ summary: String?) -> some View {
        if let summary = summary, !summary.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                sectionHeader("总结建议")
                Text(summary)
                    .font(.body)
                    .textSelection(.enabled)
            }
            .padding(12)
            .background(Color.blue.opacity(0.06))
            .cornerRadius(Theme.Radii.medium)
        }
    }

    @ViewBuilder
    private func citationsSection(_ citations: [String]?, format: String?) -> some View {
        if let citations = citations, !citations.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    let formatLabel = SurveyParameterPanel.citationFormats.first { $0.1 == (format ?? "apa") }?.0 ?? "APA"
                    sectionHeader("参考文献（\(formatLabel) 格式）")
                    Spacer()
                    Button(action: { copyToClipboard(citations.joined(separator: "\n")) }) {
                        Image(systemName: "doc.on.doc")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                    .help("复制全部引用")
                }
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(citations.enumerated()), id: \.offset) { _, cite in
                        Text(cite)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
                .padding(10)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)
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
                            if let url = paper.paperUrl, let link = URL(string: url) {
                                Link(paper.title, destination: link)
                                    .font(.subheadline.bold())
                            } else {
                                Text(paper.title)
                                    .font(.subheadline.bold())
                            }
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
                        if let doi = paper.doi, !doi.isEmpty, let url = URL(string: "https://doi.org/\(doi)") {
                            Link("DOI: \(doi)", destination: url)
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
            yearTo: nil,
            selectedPaperIds: selectedInterestId.isEmpty ? nil : selectedPaperIds
        )
    }

    private func copyToClipboard(_ text: String) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
    }

    private func exportSurveyMarkdown() {
        guard !surveyContent.isEmpty else { return }
        let savePanel = NSSavePanel()
        savePanel.allowedContentTypes = [.plainText]
        savePanel.nameFieldStringValue = "\(topic.isEmpty ? "综述" : topic).md"
        savePanel.begin { result in
            guard result == .OK, let url = savePanel.url else { return }
            do {
                try self.surveyContent.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                self.errorMessage = "导出失败: \(error.localizedDescription)"
            }
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
            saveHistory()
        }
    }

    func surveyServiceDidFinish(_ service: SurveyService) {
        isGenerating = false
    }

    private func saveHistory() {
        let maxRecords = 50
        let trimmed = Array(surveyHistory.prefix(maxRecords))
        if let data = try? JSONEncoder().encode(trimmed) {
            UserDefaults.standard.set(data, forKey: "survey_history")
        }
    }

    private func loadHistory() {
        guard let data = UserDefaults.standard.data(forKey: "survey_history"),
              let records = try? JSONDecoder().decode([SurveyRecord].self, from: data)
        else { return }
        surveyHistory = records
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
