import Foundation

@MainActor
final class SubmissionService: ObservableObject {
    private let repo = SubmissionRepository()

    // MARK: - Venues

    func listVenues(starred: Bool? = nil) -> [Venue] {
        (try? repo.listVenues(starred: starred)) ?? []
    }

    func createVenue(_ venue: Venue) {
        try? repo.createVenue(venue)
    }

    func updateVenue(_ venue: Venue) {
        try? repo.updateVenue(venue)
    }

    func deleteVenue(id: String) {
        try? repo.deleteVenue(id: id)
    }

    func toggleVenueStar(id: String) {
        try? repo.toggleVenueStar(id: id)
    }

    // MARK: - Submissions

    func listSubmissions() -> [Submission] {
        (try? repo.listSubmissions()) ?? []
    }

    func createSubmission(title: String, venueName: String? = nil, deadline: Date? = nil) -> Submission {
        let submission = Submission(
            id: UUID().uuidString,
            title: title,
            venueName: venueName,
            venueType: nil,
            status: .writing,
            deadline: deadline,
            submittedAt: nil,
            createdAt: Date()
        )
        try? repo.createSubmission(submission)
        return submission
    }

    func updateSubmission(_ submission: Submission) {
        try? repo.updateSubmission(submission)
    }

    func deleteSubmission(id: String) {
        try? repo.deleteSubmission(id: id)
    }

    // MARK: - AI Review

    func runAIReview(submissionId: String, content: String, settings: AppSettings) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                guard let client = LLMClient.fromSettings(settings) else {
                    continuation.yield("请先配置 LLM 提供商")
                    continuation.finish()
                    return
                }

                let prompt = """
                你是一位学术论文审稿人。请对以下论文进行详细评审。

                ## 论文内容
                \(content)

                请从以下维度评审：
                1. 创新性与贡献
                2. 方法论质量
                3. 实验设计与结果
                4. 写作质量
                5. 总体评价与建议
                """

                do {
                    for try await chunk in client.streamChat(
                        messages: [LLMClient.Message(role: "user", content: content)],
                        systemPrompt: prompt
                    ) {
                        continuation.yield(chunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - Versions

    func listVersions(submissionId: String) -> [PaperVersion] {
        (try? repo.listVersions(submissionId: submissionId)) ?? []
    }

    func createVersion(submissionId: String, tag: String, label: String?, stage: String?, content: String?, notes: String?) {
        let version = PaperVersion(
            id: UUID().uuidString,
            submissionId: submissionId,
            tag: tag,
            label: label,
            stage: stage,
            content: content,
            notes: notes,
            filePath: nil,
            fileName: nil,
            createdAt: Date()
        )
        try? repo.insertVersion(version)
    }

    func deleteVersion(id: String) {
        try? repo.deleteVersion(id: id)
    }

    // MARK: - Review Rounds

    func listReviewRounds(submissionId: String) -> [ReviewRound] {
        (try? repo.listReviewRounds(submissionId: submissionId)) ?? []
    }

    func listReviewComments(submissionId: String, round: Int) -> [ReviewComment] {
        (try? repo.listReviewComments(submissionId: submissionId, round: round)) ?? []
    }

    func createReviewRound(submissionId: String, round: Int, verdict: String?) {
        let r = ReviewRound(
            id: UUID().uuidString,
            submissionId: submissionId,
            round: round,
            verdict: verdict,
            receivedAt: Date()
        )
        try? repo.insertReviewRound(r)
    }

    func addReviewComment(_ comment: ReviewComment) {
        try? repo.insertReviewComment(comment)
    }

    // MARK: - Checklist

    func upsertChecklistItem(_ item: SubmissionChecklistItem) {
        try? repo.upsertChecklistItem(item)
    }
}
