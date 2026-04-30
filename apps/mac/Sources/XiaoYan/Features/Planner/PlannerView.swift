import SwiftUI

struct PlannerView: View {
    @StateObject private var knowledgeService = KnowledgeService()
    @State private var interests: [ResearchInterest] = []
    @State private var selectedInterest: ResearchInterest?
    @State private var showingCreateSheet = false

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                if interests.isEmpty {
                    emptyState
                } else {
                    List(interests, selection: $selectedInterest) { interest in
                        InterestRow(interest: interest)
                            .tag(interest)
                            .contextMenu {
                                Button("删除", role: .destructive) {
                                    knowledgeService.deleteInterest(id: interest.id)
                                    reload()
                                }
                            }
                    }
                    .listStyle(.sidebar)
                }
            }
            .navigationTitle("研究规划")
            .toolbar {
                ToolbarItem {
                    Button(action: { showingCreateSheet = true }) {
                        Label("新建方向", systemImage: "plus")
                    }
                }
            }
        } detail: {
            if let interest = selectedInterest {
                InterestDetailView(interest: interest, knowledgeService: knowledgeService)
            } else {
                ContentUnavailableView("选择研究方向", systemImage: "map")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreateSheet) {
            CreateInterestSheet(knowledgeService: knowledgeService, onCreated: reload)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "map.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("还没有研究方向")
                .font(.title3.bold())
            Text("创建你的研究方向，小妍将为你规划学习路径")
                .foregroundStyle(.secondary)
            Button("创建研究方向") { showingCreateSheet = true }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func reload() {
        interests = knowledgeService.listInterests()
    }
}

private struct InterestRow: View {
    let interest: ResearchInterest

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(interest.topic)
                .font(.subheadline.bold())
            if let keywords = interest.keywords {
                Text(keywords.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct InterestDetailView: View {
    let interest: ResearchInterest
    let knowledgeService: KnowledgeService
    @State private var isGenerating = false
    @State private var learningPath: LearningPath?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Topic
                Text(interest.topic)
                    .font(.title2.bold())

                // Keywords
                if let keywords = interest.keywords, !keywords.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("关键词").font(.headline)
                        FlowLayout(spacing: 6) {
                            ForEach(keywords, id: \.self) { kw in
                                Text(kw)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.accentColor.opacity(0.1))
                                    .cornerRadius(6)
                            }
                        }
                    }
                }

                // Profile
                if let profile = interest.profile {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("研究背景").font(.headline)
                        if let goal = profile.goal {
                            InfoRow(label: "目标", value: goal)
                        }
                        if let bg = profile.background {
                            InfoRow(label: "背景", value: bg)
                        }
                        if let tb = profile.timeBudget {
                            InfoRow(label: "时间", value: tb)
                        }
                    }
                }

                // Learning Path
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("学习路径").font(.headline)
                        Spacer()
                        if isGenerating {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Button("生成路径") {
                                Task {
                                    isGenerating = true
                                    learningPath = await knowledgeService.generateLearningPath(interest: interest, settings: AppSettings())
                                    isGenerating = false
                                }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }

                    let path = learningPath ?? interest.learningPath
                    if let stages = path?.stages, !stages.isEmpty {
                        ForEach(Array(stages.enumerated()), id: \.offset) { idx, stage in
                            HStack(alignment: .top, spacing: 12) {
                                Text("\(idx + 1)")
                                    .font(.caption.bold())
                                    .frame(width: 24, height: 24)
                                    .background(Color.accentColor)
                                    .foregroundStyle(.white)
                                    .clipShape(Circle())
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(stage.title ?? "阶段 \(idx + 1)")
                                        .font(.subheadline.bold())
                                    if let desc = stage.description {
                                        Text(desc).font(.caption).foregroundStyle(.secondary)
                                    }
                                    if let dur = stage.duration {
                                        Text("预计: \(dur)").font(.caption2).foregroundStyle(.tertiary)
                                    }
                                }
                            }
                        }
                    } else {
                        Text("点击「生成路径」让 AI 为你规划学习路径")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("方向详情")
    }
}

private struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 40, alignment: .leading)
            Text(value)
                .font(.subheadline)
        }
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(in: proposal.width ?? 0, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(in: bounds.width, subviews: subviews)
        for (idx, pos) in result.positions.enumerated() {
            subviews[idx].place(at: CGPoint(x: bounds.minX + pos.x, y: bounds.minY + pos.y), proposal: .unspecified)
        }
    }

    private func arrange(in width: CGFloat, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width, x > 0 {
                x = 0; y += rowHeight + spacing; rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }
        return (positions, CGSize(width: width, height: y + rowHeight))
    }
}

private struct CreateInterestSheet: View {
    let knowledgeService: KnowledgeService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var topic = ""
    @State private var keywordsText = ""
    @State private var goal = ""
    @State private var background = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("创建研究方向")
                .font(.headline)

            Form {
                TextField("研究主题", text: $topic)
                TextField("关键词（逗号分隔）", text: $keywordsText)
                TextField("研究目标", text: $goal, axis: .vertical)
                    .lineLimit(2...4)
                TextField("研究背景", text: $background, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let keywords = keywordsText.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    let profile = InterestProfile(goal: goal.isEmpty ? nil : goal, background: background.isEmpty ? nil : background, timeBudget: nil, constraints: nil)
                    _ = knowledgeService.createInterest(topic: topic, keywords: keywords.isEmpty ? nil : keywords, profile: profile)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 420, height: 360)
    }
}
