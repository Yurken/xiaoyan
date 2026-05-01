import SwiftUI

struct HomeView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var colorTokens: AppColorTokens
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
        .background(colorTokens.backgroundGradient.ignoresSafeArea())
        .onAppear(perform: loadData)
    }

    private func content(model: WorkbenchOverviewModel) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            heroSection(model: model)
            twoColumnSection(model: model)
            assetsSection(model: model)
            shortcutsSection
        }
        .padding(Theme.Spacing.lg)
    }

    // MARK: - Hero

    private func heroSection(model: WorkbenchOverviewModel) -> some View {
        CardView(variant: .raised, padding: Theme.Spacing.xl) {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                // Subtle rule
                subtleRule

                HStack(alignment: .top, spacing: Theme.Spacing.xl) {
                    // Left column
                    VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                        // Kicker
                        Text("小妍工作台")
                            .font(Theme.Typography.kicker)
                            .textCase(.uppercase)
                            .foregroundStyle(colorTokens.textMuted)
                            .tracking(0.16 * 11)

                        // Hero title
                        Text(model.heroTitle)
                            .font(Theme.Typography.heroTitle)
                            .minimumScaleFactor(0.6)
                            .lineLimit(2)
                            .foregroundStyle(colorTokens.text)

                        // Description
                        Text(model.heroDescription)
                            .font(Theme.Typography.body)
                            .lineSpacing(6)
                            .foregroundStyle(colorTokens.textSoft)

                        // Action buttons
                        HStack(spacing: Theme.Spacing.sm) {
                            NeumorphicButton(
                                label: model.primaryAction.label,
                                icon: "arrow.right",
                                style: .primary
                            ) {
                                router.selectedRoute = model.primaryAction.route
                            }
                            NeumorphicButton(
                                label: model.secondaryAction.label,
                                style: .secondary
                            ) {
                                router.selectedRoute = model.secondaryAction.route
                            }
                        }

                        // Metrics with divider
                        subtleRule
                        metricsGrid(metrics: model.metrics)
                    }

                    // Right column: summary items
                    VStack(spacing: Theme.Spacing.sm) {
                        ForEach(model.summaryItems, id: \.title) { item in
                            WorkbenchSummaryCard(item: item)
                        }
                    }
                    .frame(maxWidth: 320)
                }
            }
        }
    }

    private func metricsGrid(metrics: [WorkbenchMetric]) -> some View {
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.sm), count: 4),
            spacing: Theme.Spacing.sm
        ) {
            ForEach(metrics, id: \.label) { metric in
                WorkbenchMetricCard(metric: metric)
            }
        }
    }

    // MARK: - Two Column (agenda/handoff + interests/risks)

    private func twoColumnSection(model: WorkbenchOverviewModel) -> some View {
        VStack(spacing: Theme.Spacing.md) {
            HStack(alignment: .top, spacing: Theme.Spacing.md) {
                sectionCard(title: "今日推进", description: "先把今天最值得继续的事摆出来") {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.agenda) { item in
                            ListActionCard(
                                label: item.label,
                                title: item.title,
                                description: item.description,
                                tone: item.tone,
                                actionLabel: item.action.label,
                                actionRoute: item.action.route,
                                router: router,
                                showArrow: true
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity)

                sectionCard(title: "小妍交接", description: "最近的对话与整理结果", action: ("打开小妍", .copilot)) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.handoffs) { item in
                            ListActionCard(
                                label: item.label,
                                title: item.title,
                                description: item.description,
                                tone: item.tone,
                                actionLabel: item.action.label,
                                actionRoute: item.action.route,
                                router: router
                            )
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }

            HStack(alignment: .top, spacing: Theme.Spacing.md) {
                sectionCard(title: "在研主题", description: "按推进优先级排序", action: ("去规划", .planner)) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.interests) { item in
                            WorkbenchInterestCard(item: item, router: router)
                        }
                    }
                }
                .frame(maxWidth: .infinity)

                sectionCard(title: "阻塞与截止", description: "容易拖慢研究推进的事项", action: ("去投稿", .submission)) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.risks) { item in
                            WorkbenchRiskCard(item: item, router: router)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Section Card

    private func sectionCard(
        title: String,
        description: String,
        action: (String, AppRoute)? = nil,
        @ViewBuilder content: () -> some View
    ) -> some View {
        CardView(variant: .raised, padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(Theme.Typography.headline)
                            .foregroundStyle(colorTokens.text)
                        Text(description)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(colorTokens.textMuted)
                    }
                    Spacer()
                    if let action = action {
                        Button(action.0) {
                            router.selectedRoute = action.1
                        }
                        .font(Theme.Typography.caption)
                        .foregroundStyle(colorTokens.accent)
                        .buttonStyle(.plain)
                    }
                }
                content()
            }
        }
    }

    // MARK: - Assets

    private func assetsSection(model: WorkbenchOverviewModel) -> some View {
        CardView(variant: .raised, padding: Theme.Spacing.md) {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("最近沉淀")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(colorTokens.text)
                LazyVGrid(
                    columns: Array(repeating: GridItem(.flexible(), spacing: Theme.Spacing.sm), count: 3),
                    spacing: Theme.Spacing.sm
                ) {
                    ForEach(model.assets) { item in
                        WorkbenchAssetCard(item: item, router: router)
                    }
                }
            }
        }
    }

    // MARK: - Shortcuts

    private var shortcutsSection: some View {
        CardView(variant: .raised, padding: Theme.Spacing.md) {
            HStack(spacing: Theme.Spacing.md) {
                shortcutItem(icon: "map", title: "规划", description: "把研究目标、关键词和路线重新收一遍。", route: .planner, color: colorTokens.accent)
                shortcutItem(icon: "bubble.left.and.bubble.right", title: "小妍", description: "带着论文和问题继续追问，不用从头描述背景。", route: .copilot, color: colorTokens.success)
                shortcutItem(icon: "brain.head.profile", title: "知识", description: "把已经想清楚的结论沉淀下来，后面写作会更稳。", route: .knowledge, color: colorTokens.warning)
            }
        }
    }

    private func shortcutItem(icon: String, title: String, description: String, route: AppRoute, color: Color) -> some View {
        Button(action: { router.selectedRoute = route }) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.body)
                    .foregroundStyle(color)
                    .frame(width: 32, height: 32)
                    .background(color.opacity(0.12))
                    .cornerRadius(Theme.Radii.small)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(Theme.Typography.subheadline)
                        .foregroundStyle(colorTokens.text)
                    Text(description)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(colorTokens.textMuted)
                        .lineLimit(2)
                }
                Spacer()
            }
        }
        .buttonStyle(.plain)
        .hoverLift()
    }

    // MARK: - Subtle Rule

    private var subtleRule: some View {
        LinearGradient(
            colors: [.clear, colorTokens.border.opacity(0.88), .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 1)
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
