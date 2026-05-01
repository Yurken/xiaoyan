import SwiftUI

struct PlannerView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var knowledgeService = KnowledgeService()
    @State private var topic = ""
    @State private var keywords = ""
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var result: LearningPath?
    @State private var workflow: [PlannerAgentStep] = []
    @State private var expandedStage: Int? = 0

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack(spacing: 12) {
                    Image(systemName: "map.fill")
                        .font(.title2)
                        .foregroundStyle(.blue)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("研究方向规划")
                            .font(.title2.bold())
                        Text("告诉小妍你的研究方向，她来帮你梳理学习路径和先修知识")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                // Input
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("研究方向")
                            .font(.subheadline.bold())
                        TextField("例如：大语言模型的对齐技术、联邦学习隐私保护", text: $topic)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("关键词（可选，用逗号分隔）")
                            .font(.subheadline.bold())
                        TextField("例如：RLHF, PPO, reward model", text: $keywords)
                            .textFieldStyle(.roundedBorder)
                    }

                    HStack {
                        Spacer()
                        Button(action: generate) {
                            if isGenerating {
                                HStack(spacing: 6) {
                                    ProgressView().controlSize(.small)
                                    Text("正在生成...")
                                }
                            } else {
                                HStack(spacing: 6) {
                                    Image(systemName: "sparkles")
                                    Text("生成学习路径")
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
                .padding()
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)

                // Workflow
                if !workflow.isEmpty || isGenerating {
                    workflowSection
                }

                // Result
                if let result = result {
                    resultSections(result)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("研究规划")
    }

    // MARK: - Workflow

    private var workflowSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("规划能力域模型协作流程")
                    .font(.subheadline.bold())
            }

            VStack(alignment: .leading, spacing: 6) {
                ForEach(workflowSteps(), id: \.id) { step in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(step.name)
                                .font(.caption.bold())
                            Text(step.role)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        PlannerStatusBadge(status: step.status)
                    }
                    .padding(8)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)
                }
            }
        }
    }

    private func workflowSteps() -> [PlannerAgentStep] {
        if !workflow.isEmpty { return workflow }
        return defaultPlannerWorkflow()
    }

    // MARK: - Result Sections

    @ViewBuilder
    private func resultSections(_ result: LearningPath) -> some View {
        overviewSection(result)
        prerequisitesSection(result)
        stagesSection(result)
        classicPapersSection(result)
        researchDirectionsSection(result)
        toolsSection(result)
    }

    @ViewBuilder
    private func overviewSection(_ result: LearningPath) -> some View {
        if let overview = result.overview {
            resultCard(title: "领域概述", icon: "book") {
                Text(overview)
                    .font(.body)
                    .textSelection(.enabled)
            }
        }
    }

    @ViewBuilder
    private func prerequisitesSection(_ result: LearningPath) -> some View {
        if let prerequisites = result.prerequisites, !prerequisites.isEmpty {
            resultCard(title: "先修知识", icon: "graduationcap") {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(prerequisites.enumerated()), id: \.offset) { _, pre in
                        prerequisiteRow(pre)
                    }
                }
            }
        }
    }

    private func prerequisiteRow(_ pre: LearningPrerequisite) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(pre.name ?? "")
                .font(.subheadline.bold())
            if let desc = pre.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let resources = pre.resources, !resources.isEmpty {
                HStack(spacing: 6) {
                    ForEach(resources.prefix(4), id: \.self) { r in
                        Text(r)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func stagesSection(_ result: LearningPath) -> some View {
        let stages = result.learningStages ?? result.stages?.enumerated().map { idx, s in
            LearningStageDetail(stage: idx + 1, title: s.title, duration: s.duration, goals: nil, topics: nil, resources: s.resources)
        }
        if let stages = stages, !stages.isEmpty {
            resultCard(title: "学习路径", icon: "list.number") {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(stages.enumerated()), id: \.offset) { idx, stage in
                        stageRow(stage: stage, idx: idx, total: stages.count)
                    }
                }
            }
        }
    }

    private func stageRow(stage: LearningStageDetail, idx: Int, total: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { expandedStage = expandedStage == idx ? nil : idx }) {
                HStack(spacing: 12) {
                    Text("\(stage.stage ?? (idx + 1))")
                        .font(.caption.bold())
                        .frame(width: 24, height: 24)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stage.title ?? "阶段 \(idx + 1)")
                            .font(.subheadline.bold())
                        if let duration = stage.duration {
                            Text(duration)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Image(systemName: expandedStage == idx ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.vertical, 10)

            if expandedStage == idx {
                stageDetail(stage)
                    .padding(.bottom, 10)
            }

            if idx < total - 1 {
                Divider()
            }
        }
        .padding(.horizontal, 12)
    }

    private func stageDetail(_ stage: LearningStageDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let goals = stage.goals, !goals.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("学习目标")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(goals, id: \.self) { g in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                                .foregroundStyle(.blue)
                            Text(g)
                                .font(.caption)
                        }
                    }
                }
            }
            if let topics = stage.topics, !topics.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("涵盖主题")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    FlowLayout(spacing: 6) {
                        ForEach(topics, id: \.self) { t in
                            Text(t)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                }
            }
            if let resources = stage.resources, !resources.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("推荐资源")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(resources, id: \.self) { r in
                        HStack(alignment: .top, spacing: 4) {
                            Image(systemName: "book")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(r)
                                .font(.caption)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func classicPapersSection(_ result: LearningPath) -> some View {
        if let papers = result.classicPapers, !papers.isEmpty {
            resultCard(title: "经典必读论文", icon: "doc.text") {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(papers.enumerated()), id: \.offset) { idx, paper in
                        classicPaperRow(paper: paper, idx: idx)
                    }
                }
            }
        }
    }

    private func classicPaperRow(paper: ClassicPaper, idx: Int) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(String(format: "%02d", idx + 1))
                .font(.title3.bold())
                .foregroundStyle(.secondary.opacity(0.3))
            VStack(alignment: .leading, spacing: 2) {
                Text(paper.title ?? "")
                    .font(.subheadline.bold())
                if let authors = paper.authors, let year = paper.year {
                    Text("\(authors) · \(year)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let reason = paper.reason {
                    Text(reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func researchDirectionsSection(_ result: LearningPath) -> some View {
        if let directions = result.researchDirections, !directions.isEmpty {
            resultCard(title: "进一步探索方向", icon: "target") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(Array(directions.enumerated()), id: \.offset) { _, dir in
                        directionCard(dir)
                    }
                }
            }
        }
    }

    private func directionCard(_ dir: ResearchDirection) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "target")
                    .font(.caption2)
                    .foregroundStyle(.blue)
                Text(dir.direction ?? "")
                    .font(.subheadline.bold())
            }
            if let desc = dir.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let problems = dir.openProblems, !problems.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(problems.prefix(3), id: \.self) { p in
                        HStack(alignment: .top, spacing: 4) {
                            Text("→")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(p)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func toolsSection(_ result: LearningPath) -> some View {
        if let tools = result.toolsAndFrameworks, !tools.isEmpty {
            resultCard(title: "常用工具 & 框架", icon: "wrench") {
                FlowLayout(spacing: 8) {
                    ForEach(tools, id: \.self) { t in
                        Text(t)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(12)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func resultCard(title: String, icon: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .foregroundStyle(.blue)
                Text(title)
                    .font(.headline)
            }
            content()
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Actions

    private func generate() {
        guard !topic.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isGenerating = true
        errorMessage = nil
        result = nil
        workflow = defaultPlannerWorkflow().enumerated().map { idx, step in
            var s = step
            s.status = idx == 0 ? .running : .pending
            return s
        }

        let topicTrimmed = topic.trimmingCharacters(in: .whitespaces)
        let keywordsList = keywords.components(separatedBy: CharacterSet(charactersIn: ",， "))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        Task {
            let path = await knowledgeService.generatePlannerResult(
                topic: topicTrimmed,
                keywords: keywordsList,
                settings: settings
            )
            await MainActor.run {
                if let path = path {
                    self.result = path
                    self.workflow = [
                        PlannerAgentStep(id: "analyst", name: "小妍模型", role: "拆解研究主题与能力目标", status: .done, summary: "完成「\(topicTrimmed)」的学习能力拆解"),
                        PlannerAgentStep(id: "scout", name: "探知模型", role: "筛选候选经典论文", status: .done, summary: "已完成候选文献推荐（\(path.classicPapers?.count ?? 0) 篇）"),
                        PlannerAgentStep(id: "designer", name: "谋策模型", role: "生成结构化学习路径", status: .done, summary: "路径已生成（\(path.learningStages?.count ?? path.stages?.count ?? 0) 个阶段）"),
                    ]
                } else {
                    errorMessage = "生成未完成，请稍后重试。"
                    let runningIdx = workflow.firstIndex { $0.status == .running }
                    let idx = runningIdx ?? 0
                    workflow[idx].status = .failed
                    workflow[idx].error = "生成未完成"
                }
                isGenerating = false
            }
        }
    }

    private func defaultPlannerWorkflow() -> [PlannerAgentStep] {
        [
            PlannerAgentStep(id: "analyst", name: "小妍模型", role: "拆解研究主题与能力目标", status: .pending),
            PlannerAgentStep(id: "scout", name: "探知模型", role: "筛选候选经典论文", status: .pending),
            PlannerAgentStep(id: "designer", name: "谋策模型", role: "生成结构化学习路径", status: .pending),
        ]
    }
}

// MARK: - Planner Agent Step

struct PlannerAgentStep: Identifiable {
    let id: String
    let name: String
    let role: String
    var status: PlannerAgentStatus
    var summary: String?
    var error: String?
}

enum PlannerAgentStatus {
    case pending, running, done, failed
}

// MARK: - Status Badge

private struct PlannerStatusBadge: View {
    let status: PlannerAgentStatus

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

// MARK: - Flow Layout

