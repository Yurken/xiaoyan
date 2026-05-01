import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: AppRouter
    @State private var model: WorkbenchOverviewModel?
    @State private var loading = true

    var body: some View {
        ScrollView {
            if let model = model {
                content(model: model)
            } else if loading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(40)
            } else {
                ContentUnavailableView("暂无法加载工作台", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle("概述")
        .background(Theme.Colors.background)
        .onAppear(perform: loadData)
    }

    private func content(model: WorkbenchOverviewModel) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
            heroSection(model: model)
            metricsSection(model: model)
            summarySection(model: model)
            twoColumnSection(model: model)
            assetsSection(model: model)
            shortcutsSection
        }
        .padding()
    }

    // MARK: - Hero

    private func heroSection(model: WorkbenchOverviewModel) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("小妍工作台")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text(model.heroTitle)
                .font(.title.bold())

            Text(model.heroDescription)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                Button(action: { router.selectedRoute = model.primaryAction.route }) {
                    HStack(spacing: 6) {
                        Text(model.primaryAction.label)
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(.borderedProminent)

                Button(action: { router.selectedRoute = model.secondaryAction.route }) {
                    Text(model.secondaryAction.label)
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

    private func metricsSection(model: WorkbenchOverviewModel) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(model.metrics, id: \.label) { metric in
                WorkbenchMetricCard(metric: metric)
            }
        }
    }

    // MARK: - Summary

    private func summarySection(model: WorkbenchOverviewModel) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(model.summaryItems, id: \.title) { item in
                WorkbenchSummaryCard(item: item)
            }
        }
    }

    // MARK: - Two Column

    private func twoColumnSection(model: WorkbenchOverviewModel) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)], spacing: 16) {
            agendaPanel(model: model)
            handoffPanel(model: model)
            interestsPanel(model: model)
            risksPanel(model: model)
        }
    }

    private func agendaPanel(model: WorkbenchOverviewModel) -> some View {
        panel(title: "今日推进", subtitle: "先把今天最值得继续的事摆出来") {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(model.agenda) { item in
                    WorkbenchAgendaCard(item: item, router: router)
                }
            }
        }
    }

    private func handoffPanel(model: WorkbenchOverviewModel) -> some View {
        panel(title: "小妍交接", subtitle: "最近的对话与整理结果", action: ("打开小妍", .copilot)) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(model.handoffs) { item in
                    WorkbenchHandoffCard(item: item, router: router)
                }
            }
        }
    }

    private func interestsPanel(model: WorkbenchOverviewModel) -> some View {
        panel(title: "在研主题", subtitle: "按推进优先级排序", action: ("去规划", .planner)) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(model.interests) { item in
                    WorkbenchInterestCard(item: item, router: router)
                }
            }
        }
    }

    private func risksPanel(model: WorkbenchOverviewModel) -> some View {
        panel(title: "阻塞与截止", subtitle: "容易拖慢研究推进的事项", action: ("去投稿", .submission)) {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(model.risks) { item in
                    WorkbenchRiskCard(item: item, router: router)
                }
            }
        }
    }

    private func panel(
        title: String,
        subtitle: String,
        action: (label: String, route: AppRoute)? = nil,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let action = action {
                    Button(action.label) {
                        router.selectedRoute = action.route
                    }
                    .font(.caption)
                }
            }
            content()
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Assets

    private func assetsSection(model: WorkbenchOverviewModel) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("最近沉淀")
                .font(.headline)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(model.assets) { item in
                    WorkbenchAssetCard(item: item, router: router)
                }
            }
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    // MARK: - Shortcuts

    private var shortcutsSection: some View {
        HStack(spacing: 16) {
            shortcutItem(icon: "map", title: "规划", description: "把研究目标、关键词和路线重新收一遍。", route: .planner, color: .blue)
            shortcutItem(icon: "bubble.left.and.bubble.right", title: "小妍", description: "带着论文和问题继续追问，不用从头描述背景。", route: .copilot, color: .green)
            shortcutItem(icon: "brain.head.profile", title: "知识", description: "把已经想清楚的结论沉淀下来，后面写作会更稳。", route: .knowledge, color: .orange)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }

    private func shortcutItem(icon: String, title: String, description: String, route: AppRoute, color: Color) -> some View {
        Button(action: { router.selectedRoute = route }) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundStyle(color)
                    .frame(width: 32, height: 32)
                    .background(color.opacity(0.12))
                    .cornerRadius(8)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.bold())
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                Spacer()
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Data Loading

    private func loadData() {
        loading = true
        let paperRepo = PaperRepository()
        let subRepo = SubmissionRepository()
        let knRepo = KnowledgeRepository()
        let chatRepo = ChatRepository()

        let papers = (try? paperRepo.list()) ?? []
        let interests = (try? knRepo.listInterests()) ?? []
        let notes = (try? knRepo.listNotes()) ?? []
        let sessions = (try? chatRepo.listSessions()) ?? []
        let submissionStats = (try? subRepo.stats()) ?? SubmissionRepository.SubmissionStats(active: 0, pendingReviews: 0, upcomingDdls: [])

        let builder = WorkbenchBuilder(
            papers: papers,
            interests: interests,
            notes: notes,
            sessions: sessions,
            submissionStats: submissionStats
        )
        model = builder.build()
        loading = false
    }
}
