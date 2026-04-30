import SwiftUI

struct SubmissionView: View {
    @StateObject private var submissionService = SubmissionService()
    @State private var selectedTab: Tab = .submissions

    enum Tab: String, CaseIterable {
        case submissions = "投稿"
        case kanban = "看板"
        case venues = "期刊/会议"
        case recommendations = "智能推荐"
        case checklist = "清单"
        case versions = "版本"
        case reviewRounds = "审稿"
        case review = "AI 审稿"
        case coverLetter = "投稿信/润色"
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("类型", selection: $selectedTab) {
                ForEach(Tab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            switch selectedTab {
            case .submissions: SubmissionsListView(service: submissionService)
            case .kanban: KanbanView(service: submissionService)
            case .venues: VenuesListView(service: submissionService)
            case .recommendations: VenueRecommendationsView(service: submissionService)
            case .checklist: ChecklistView(service: submissionService)
            case .versions: VersionsView(service: submissionService)
            case .reviewRounds: ReviewRoundsView(service: submissionService)
            case .review: AIReviewView(service: submissionService)
            case .coverLetter: CoverLetterView(service: submissionService)
            }
        }
        .navigationTitle("投稿")
    }
}
