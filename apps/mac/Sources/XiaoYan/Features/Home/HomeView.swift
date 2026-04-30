import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: AppRouter
    @State private var paperCount = 0
    @State private var submissionCount = 0
    @State private var experimentCount = 0
    @State private var noteCount = 0
    @State private var recentPapers: [Paper] = []
    @State private var upcomingDeadlines: [Submission] = []
    @State private var interests: [ResearchInterest] = []
    @State private var recentNotes: [KnowledgeNote] = []
    @State private var recentSessions: [ChatSession] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Hero
                heroSection

                // Metrics
                metricsSection

                // Two-column grid
                LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
                    agendaSection
                    handoffSection
                    interestsSection
                    risksSection
                }

                // Recent assets
                assetsSection
            }
            .padding()
        }
        .navigationTitle("首页")
        .onAppear(perform: loadData)
    }

    // MARK: - Hero

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("小妍工作台")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text("欢迎回来")
                .font(.title.bold())

            Text("让研究从首页就能接上。优先显示当前目标最相关的论文、笔记和主题。")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Button(action: { router.selectedRoute = .copilot }) {
                    HStack(spacing: 6) {
                        Text("开始对话")
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(.borderedProminent)

                Button(action: { router.selectedRoute = .planner }) {
                    Text("去规划")
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Metrics

    private var metricsSection: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MetricItem(label: "论文", value: "\(paperCount)")
            MetricItem(label: "投稿", value: "\(submissionCount)")
            MetricItem(label: "实验", value: "\(experimentCount)")
            MetricItem(label: "笔记", value: "\(noteCount)")
        }
    }

    // MARK: - Agenda

    private var agendaSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("今日推进")
                        .font(.headline)
                    Text("先把今天最值得继续的事摆出来")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            let agenda = buildAgenda()
            if agenda.isEmpty {
                Text("暂无待办事项。从上传论文或创建研究方向开始吧。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(agenda) { item in
                        AgendaCard(item: item)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Handoff

    private var handoffSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("小妍交接")
                        .font(.headline)
                    Text("最近的对话与整理结果")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("打开小妍") {
                    router.selectedRoute = .copilot
                }
                .font(.caption)
            }

            let handoffs = buildHandoffs()
            if handoffs.isEmpty {
                Text("暂无交接内容。先去和小妍对话吧。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(handoffs) { item in
                        HandoffCard(item: item, router: router)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Interests

    private var interestsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("在研主题")
                        .font(.headline)
                    Text("按推进优先级排序")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("去规划") {
                    router.selectedRoute = .planner
                }
                .font(.caption)
            }

            if interests.isEmpty {
                Text("暂无研究主题。先从一个研究问题开始，小妍会帮你搭起路线。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(interests.prefix(3)) { interest in
                        InterestCard(interest: interest, router: router)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Risks

    private var risksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("阻塞与截止")
                        .font(.headline)
                    Text("容易拖慢研究推进的事项")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("去投稿") {
                    router.selectedRoute = .submission
                }
                .font(.caption)
            }

            if upcomingDeadlines.isEmpty {
                Text("暂无即将截止的投稿。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(upcomingDeadlines.prefix(3)) { sub in
                        RiskCard(submission: sub)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Assets

    private var assetsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("最近沉淀")
                    .font(.headline)
                Spacer()
            }

            let assets = buildAssets()
            if assets.isEmpty {
                Text("暂无沉淀内容。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(assets.prefix(6)) { item in
                        AssetCard(item: item, router: router)
                    }
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Data Loading

    private func loadData() {
        let paperRepo = PaperRepository()
        let subRepo = SubmissionRepository()
        let expRepo = ExperimentRepository()
        let knRepo = KnowledgeRepository()
        let chatRepo = ChatRepository()

        paperCount = (try? paperRepo.list().count) ?? 0
        submissionCount = (try? subRepo.listSubmissions().count) ?? 0
        experimentCount = (try? expRepo.list().count) ?? 0
        noteCount = (try? knRepo.listNotes().count) ?? 0
        recentPapers = (try? paperRepo.list().suffix(5).reversed()) ?? []
        upcomingDeadlines = ((try? subRepo.listSubmissions()) ?? [])
            .filter { $0.deadline != nil }
            .sorted { ($0.deadline ?? .distantFuture) < ($1.deadline ?? .distantFuture) }
        interests = (try? knRepo.listInterests()) ?? []
        recentNotes = (try? knRepo.listNotes().suffix(3).reversed()) ?? []
        recentSessions = (try? chatRepo.listSessions().suffix(3).reversed()) ?? []
    }

    // MARK: - Agenda Builder

    private func buildAgenda() -> [AgendaItem] {
        var items: [AgendaItem] = []

        // Papers needing analysis
        let unanalyzed = recentPapers.filter { $0.status == .parsed || $0.status == .uploaded }
        if let first = unanalyzed.first {
            items.append(AgendaItem(
                id: "paper-\(first.id)",
                label: "论文",
                title: first.title,
                description: "已完成上传，建议开始精读分析",
                action: { router.selectedRoute = .papers }
            ))
        }

        // Upcoming deadlines within 7 days
        let soon = upcomingDeadlines.filter {
            guard let ddl = $0.deadline else { return false }
            return ddl.timeIntervalSinceNow < 7 * 86400
        }
        if let first = soon.first {
            items.append(AgendaItem(
                id: "deadline-\(first.id)",
                label: "截止",
                title: first.title,
                description: "即将截止，请检查投稿准备进度",
                action: { router.selectedRoute = .submission }
            ))
        }

        // Interests without learning path
        let noPath = interests.filter { $0.learningPath == nil }
        if let first = noPath.first {
            items.append(AgendaItem(
                id: "interest-\(first.id)",
                label: "规划",
                title: first.topic,
                description: "尚未生成学习路径，建议立即规划",
                action: { router.selectedRoute = .planner }
            ))
        }

        return items.prefix(3).map { $0 }
    }

    // MARK: - Handoff Builder

    private func buildHandoffs() -> [HandoffItem] {
        var items: [HandoffItem] = []

        for session in recentSessions.prefix(2) {
            items.append(HandoffItem(
                id: "session-\(session.id)",
                label: "对话",
                title: session.title ?? "新对话",
                description: "继续追问，不用从头描述背景",
                action: { router.selectedRoute = .copilot }
            ))
        }

        for note in recentNotes.prefix(2) {
            items.append(HandoffItem(
                id: "note-\(note.id)",
                label: "笔记",
                title: note.title,
                description: String(note.content.prefix(60)) + (note.content.count > 60 ? "…" : ""),
                action: { router.selectedRoute = .knowledge }
            ))
        }

        return items.prefix(3).map { $0 }
    }

    // MARK: - Asset Builder

    private func buildAssets() -> [AssetItem] {
        var items: [AssetItem] = []

        for paper in recentPapers.prefix(2) {
            items.append(AssetItem(
                id: "paper-\(paper.id)",
                label: "论文",
                title: paper.title,
                description: paper.authors.joined(separator: ", "),
                action: { router.selectedRoute = .papers }
            ))
        }

        for note in recentNotes.prefix(2) {
            items.append(AssetItem(
                id: "note-\(note.id)",
                label: "笔记",
                title: note.title,
                description: String(note.content.prefix(80)) + (note.content.count > 80 ? "…" : ""),
                action: { router.selectedRoute = .knowledge }
            ))
        }

        for interest in interests.prefix(2) {
            items.append(AssetItem(
                id: "interest-\(interest.id)",
                label: "研究方向",
                title: interest.topic,
                description: interest.keywords?.joined(separator: ", ") ?? "",
                action: { router.selectedRoute = .planner }
            ))
        }

        return items
    }
}

// MARK: - Supporting Types

private struct AgendaItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let action: () -> Void
}

private struct HandoffItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let action: () -> Void
}

private struct AssetItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let action: () -> Void
}

// MARK: - Cards

private struct MetricItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.bold())
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }
}

private struct AgendaCard: View {
    let item: AgendaItem

    var body: some View {
        Button(action: item.action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.label)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.12))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                    Spacer()
                    Image(systemName: "arrow.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(10)
            .background(Color(nsColor: .windowBackgroundColor))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

private struct HandoffCard: View {
    let item: HandoffItem
    let router: AppRouter

    var body: some View {
        Button(action: item.action) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(item.label)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.12))
                        .foregroundColor(.green)
                        .cornerRadius(4)
                    Spacer()
                }
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(10)
            .background(Color(nsColor: .windowBackgroundColor))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

private struct InterestCard: View {
    let interest: ResearchInterest
    let router: AppRouter

    var body: some View {
        Button(action: { router.selectedRoute = .planner }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(interest.topic)
                        .font(.subheadline.bold())
                        .lineLimit(1)
                    Spacer()
                    if interest.learningPath != nil {
                        Text("已有路径")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.12))
                            .foregroundColor(.green)
                            .cornerRadius(4)
                    } else {
                        Text("待规划")
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.12))
                            .foregroundColor(.orange)
                            .cornerRadius(4)
                    }
                }

                if let keywords = interest.keywords, !keywords.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(keywords.prefix(3), id: \.self) { kw in
                            Text(kw)
                                .font(.caption2)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                }

                if let path = interest.learningPath, let firstStage = path.stages?.first, let desc = firstStage.description {
                    Text(desc)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            .padding(10)
            .background(Color(nsColor: .windowBackgroundColor))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

private struct RiskCard: View {
    let submission: Submission

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(submission.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Spacer()
                if let deadline = submission.deadline {
                    let daysLeft = Int(deadline.timeIntervalSinceNow / 86400)
                    Text(daysLeft <= 0 ? "已过期" : "还剩 \(daysLeft) 天")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(daysLeft <= 3 ? Color.red.opacity(0.12) : Color.orange.opacity(0.12))
                        .foregroundColor(daysLeft <= 3 ? .red : .orange)
                        .cornerRadius(4)
                }
            }
            if let venue = submission.venueName {
                Text(venue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let deadline = submission.deadline {
                Text(deadline, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(Color(nsColor: .windowBackgroundColor))
        .cornerRadius(10)
    }
}

private struct AssetCard: View {
    let item: AssetItem
    let router: AppRouter

    var body: some View {
        Button(action: item.action) {
            VStack(alignment: .leading, spacing: 6) {
                Text(item.label)
                    .font(.caption2.bold())
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Text(item.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(item.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(nsColor: .windowBackgroundColor))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}
