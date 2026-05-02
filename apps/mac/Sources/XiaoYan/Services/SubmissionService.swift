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

    // MARK: - Mock Review

    /// 多 reviewer 模拟审稿，每完成一位 reviewer 就 yield 一次。
    /// 与 desktop `submission:ai_review:reviewer` 事件流语义对齐（粒度=完整 reviewer JSON）。
    nonisolated func runMockReview(
        content: String,
        reviewerCount: Int,
        strictness: MockStrictness,
        settings: AppSettings
    ) -> AsyncThrowingStream<MockReviewerResult, Error> {
        AsyncThrowingStream { continuation in
            Task {
                let client = await MainActor.run {
                    LLMClient.fromSettings(
                        settings,
                        modelKeys: ["paper_analysis_model"],
                        temperatureKeys: ["paper_analysis_temperature"]
                    )
                }
                guard let client else {
                    continuation.finish(throwing: LLMError.apiKeyMissing)
                    return
                }

                let count = max(2, min(reviewerCount, 4))
                for index in 1...count {
                    let isAC = (count == 4 && index == 4)
                    let reviewerName = isAC ? "AC（领域主席）" : "Reviewer \(index)"
                    let systemPrompt = Self.mockReviewSystemPrompt(
                        reviewerName: reviewerName,
                        isAreaChair: isAC,
                        strictness: strictness
                    )
                    do {
                        let raw = try await client.chat(
                            messages: [LLMClient.Message(role: "user", content: content)],
                            systemPrompt: systemPrompt
                        )
                        let result = Self.parseMockReviewer(raw: raw, reviewer: reviewerName)
                        continuation.yield(result)
                    } catch {
                        continuation.finish(throwing: error)
                        return
                    }
                }
                continuation.finish()
            }
        }
    }

    /// 将 Mock Review 结果导入为新一轮 review_rounds + review_comments，返回 round 号
    @discardableResult
    func importMockReviewAsRound(
        submissionId: String,
        results: [MockReviewerResult]
    ) -> Int {
        guard !results.isEmpty else { return 0 }
        let existing = (try? repo.listReviewRounds(submissionId: submissionId)) ?? []
        let nextRound = (existing.map(\.round).max() ?? 0) + 1
        let verdict = dominantVerdict(results)?.rawValue ?? "major_revision"

        let round = ReviewRound(
            id: UUID().uuidString,
            submissionId: submissionId,
            round: nextRound,
            verdict: verdict,
            receivedAt: Date()
        )
        try? repo.upsertReviewRound(round)

        for r in results {
            let comment = ReviewComment(
                id: UUID().uuidString,
                submissionId: submissionId,
                round: nextRound,
                reviewer: r.reviewer,
                content: r.renderedMarkdown,
                response: nil,
                resolved: false,
                tags: r.tags,
                createdAt: Date()
            )
            try? repo.insertReviewComment(comment)
        }
        return nextRound
    }

    // MARK: - Mock Review helpers

    private static nonisolated func mockReviewSystemPrompt(
        reviewerName: String,
        isAreaChair: Bool,
        strictness: MockStrictness
    ) -> String {
        let role = isAreaChair
            ? "你是 \(reviewerName)（Area Chair），需综合各位审稿人的意见给出元评审"
            : "你是 \(reviewerName)，作为该领域资深学者进行同行评议"
        return """
        \(role)。请以 \(strictness.promptPhrase) 的态度评审下列论文。

        必须严格输出 **单个 JSON 对象**，不要任何额外文本或 Markdown 代码块标记，结构如下：

        {
          "summary": "用 2-3 句话概括论文工作",
          "strengths": ["优点1", "优点2", "..."],
          "weaknesses": ["缺点1", "缺点2", "..."],
          "questions": ["问题1", "问题2", "..."],
          "verdict": "accept | weak_accept | weak_reject | reject",
          "score": 1-10 之间的整数
        }

        要求：
        - 所有字段必填，列表至少包含 1 条
        - verdict 取值仅限 accept / weak_accept / weak_reject / reject 四选一
        - score 为整数（1-10）
        - 直接返回 JSON，不要包裹 ```json``` 代码块
        """
    }

    private static nonisolated func parseMockReviewer(raw: String, reviewer: String) -> MockReviewerResult {
        let trimmed = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = trimmed.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return MockReviewerResult(
                reviewer: reviewer,
                summary: trimmed.isEmpty ? "（解析失败，无内容）" : trimmed,
                strengths: [],
                weaknesses: [],
                questions: [],
                verdict: .majorRevision,
                score: nil,
                tags: []
            )
        }

        let summary = json["summary"] as? String ?? ""
        let strengths = (json["strengths"] as? [String]) ?? []
        let weaknesses = (json["weaknesses"] as? [String]) ?? []
        let questions = (json["questions"] as? [String]) ?? []
        let verdict = MockReviewVerdict.fromBackendString((json["verdict"] as? String) ?? "")
        let score = (json["score"] as? Int) ?? (json["score"] as? Double).map { Int($0) }

        return MockReviewerResult(
            reviewer: reviewer,
            summary: summary,
            strengths: strengths,
            weaknesses: weaknesses,
            questions: questions,
            verdict: verdict,
            score: score
        )
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

    func updateVersion(_ version: PaperVersion) {
        try? repo.updateVersion(version)
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

    func updateReviewComment(_ comment: ReviewComment) {
        try? repo.updateReviewComment(comment)
    }

    // MARK: - Checklist

    func upsertChecklistItem(_ item: SubmissionChecklistItem) {
        try? repo.upsertChecklistItem(item)
    }
}
