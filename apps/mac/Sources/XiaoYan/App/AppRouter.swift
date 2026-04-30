import SwiftUI

enum AppRoute: String, CaseIterable, Identifiable {
    case home
    case copilot
    case papers
    case planner
    case survey
    case knowledge
    case experiment
    case submission
    case tools

    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: return "首页"
        case .copilot: return "小妍"
        case .papers: return "论文"
        case .planner: return "规划"
        case .survey: return "综述"
        case .knowledge: return "知识"
        case .experiment: return "实验"
        case .submission: return "投稿"
        case .tools: return "工具"
        }
    }

    var icon: String {
        switch self {
        case .home: return "house"
        case .copilot: return "bubble.left.and.bubble.right"
        case .papers: return "doc.text"
        case .planner: return "map"
        case .survey: return "books.vertical"
        case .knowledge: return "brain.head.profile"
        case .experiment: return "flask"
        case .submission: return "paperplane"
        case .tools: return "wrench.and.screwdriver"
        }
    }
}

@MainActor
final class AppRouter: ObservableObject {
    @Published var selectedRoute: AppRoute? = .home

    @ViewBuilder
    var destinationView: some View {
        switch selectedRoute {
        case .home: HomeView()
        case .copilot: CopilotView()
        case .papers: PapersView()
        case .planner: PlannerView()
        case .survey: SurveyView()
        case .knowledge: KnowledgeView()
        case .experiment: ExperimentView()
        case .submission: SubmissionView()
        case .tools: ToolsView()
        case nil: HomeView()
        }
    }
}
