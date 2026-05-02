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
                    LearningPathView(path: result)
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

