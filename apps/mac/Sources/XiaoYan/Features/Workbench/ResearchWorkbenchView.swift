import SwiftUI

enum WorkbenchTab: String, CaseIterable {
    case planner = "规划"
    case papers = "论文"
    case xiaoyan = "小妍"
    case notes = "笔记"
    case tools = "工具"
}

struct ResearchWorkbenchView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var settings: AppSettings
    @StateObject private var knowledgeService = KnowledgeService()
    @StateObject private var paperService = PaperService()
    private let chatRepo = ChatRepository()

    let interestId: String

    @State private var interest: ResearchInterest?
    @State private var papers: [Paper] = []
    @State private var notes: [KnowledgeNote] = []
    @State private var sessions: [ChatSession] = []
    @State private var selectedTab: WorkbenchTab = .planner

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            tabContent
        }
        .onAppear(perform: load)
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Button(action: { router.closeWorkbench() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text("返回")
                    }
                }
                .buttonStyle(.borderless)

                BrandLogoView(name: "app-logo", width: 32, height: 32)

                if let interest = interest {
                    Text(interest.topic)
                        .font(.headline.bold())
                        .lineLimit(1)
                } else {
                    Text("工作台")
                        .font(.headline.bold())
                }

                Spacer()

                HStack(spacing: 8) {
                    BadgeView(text: "\(papers.count) 论文", variant: .info)
                    BadgeView(text: "\(sessions.count) 会话", variant: .success)
                    BadgeView(text: "\(notes.count) 笔记", variant: .warning)
                }
            }

            Picker("Tab", selection: $selectedTab) {
                ForEach(WorkbenchTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding()
    }

    // MARK: - Tab Content

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .planner:
            plannerTab
        case .papers:
            ScopedPapersView(
                interestId: interestId,
                papers: papers,
                paperService: paperService,
                settings: settings,
                onUpdate: load
            )
        case .xiaoyan:
            InterestScopedCopilotView(interestId: interestId)
                .environmentObject(settings)
        case .notes:
            ScopedNotesView(
                interestId: interestId,
                interest: interest,
                notes: notes,
                knowledgeService: knowledgeService,
                settings: settings,
                onUpdate: load
            )
        case .tools:
            ToolsView()
        }
    }

    @ViewBuilder
    private var plannerTab: some View {
        ScrollView {
            if let path = interest?.learningPath {
                LearningPathView(path: path)
                    .padding()
            } else {
                emptyState(
                    icon: "map",
                    title: "暂无学习路径",
                    message: "在全局「规划」页面生成路径后，将自动关联到此工作台。"
                )
            }
        }
    }

    private var xiaoyanPlaceholder: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("小妍对话")
                .font(.subheadline.bold())
            Text("会话列表将在后续版本接入。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.subheadline.bold())
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }

    // MARK: - Data

    private func load() {
        let interests = knowledgeService.listInterests()
        interest = interests.first { $0.id == interestId }
        papers = paperService.list(researchInterestId: interestId)
        notes = knowledgeService.listNotes(researchInterestId: interestId)
        sessions = (try? chatRepo.listSessions())?.filter {
            $0.contextType == "interest" && $0.contextId == interestId
        } ?? []
    }
}
