import Foundation
import SwiftUI

enum MockStrictness: String, CaseIterable, Codable {
    case lenient, balanced, strict

    var displayName: String {
        switch self {
        case .lenient: return "宽松"
        case .balanced: return "平衡"
        case .strict: return "严格"
        }
    }

    var promptPhrase: String {
        switch self {
        case .lenient: return "宽松友好，倾向于发现工作的优点与潜力"
        case .balanced: return "平衡严谨，客观指出优缺点"
        case .strict: return "严格挑剔，深入挖掘方法、实验与论证的潜在缺陷"
        }
    }

    var color: Color {
        switch self {
        case .lenient: return .green
        case .balanced: return .blue
        case .strict: return .red
        }
    }
}

enum MockReviewVerdict: String, Codable, CaseIterable, Hashable {
    case accept
    case minorRevision = "minor_revision"
    case majorRevision = "major_revision"
    case reject

    var displayName: String {
        switch self {
        case .accept: return "接收"
        case .minorRevision: return "小修"
        case .majorRevision: return "大修"
        case .reject: return "拒稿"
        }
    }

    var color: Color {
        switch self {
        case .accept: return .green
        case .minorRevision: return .blue
        case .majorRevision: return .orange
        case .reject: return .red
        }
    }

    /// 将 LLM 输出 (accept/weak_accept/weak_reject/reject) 映射到 4 态 verdict
    static func fromBackendString(_ raw: String) -> MockReviewVerdict {
        switch raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines) {
        case "accept": return .accept
        case "weak_accept", "minor_revision", "minor": return .minorRevision
        case "weak_reject", "major_revision", "major": return .majorRevision
        case "reject": return .reject
        default: return .majorRevision
        }
    }
}

struct MockReviewerResult: Identifiable, Hashable {
    let id: UUID
    let reviewer: String
    let summary: String
    let strengths: [String]
    let weaknesses: [String]
    let questions: [String]
    let verdict: MockReviewVerdict
    let score: Int?
    let tags: [String]

    init(
        id: UUID = UUID(),
        reviewer: String,
        summary: String,
        strengths: [String],
        weaknesses: [String],
        questions: [String],
        verdict: MockReviewVerdict,
        score: Int? = nil,
        tags: [String] = ["方法", "实验"]
    ) {
        self.id = id
        self.reviewer = reviewer
        self.summary = summary
        self.strengths = strengths
        self.weaknesses = weaknesses
        self.questions = questions
        self.verdict = verdict
        self.score = score
        self.tags = tags
    }

    /// 与 desktop `Submission.tsx:178-182` 同款 markdown 渲染
    var renderedMarkdown: String {
        var parts: [String] = []
        if !summary.isEmpty {
            parts.append("**Summary:** \(summary)")
        }
        if !strengths.isEmpty {
            parts.append("**Strengths:**\n" + strengths.map { "- \($0)" }.joined(separator: "\n"))
        }
        if !weaknesses.isEmpty {
            parts.append("**Weaknesses:**\n" + weaknesses.map { "- \($0)" }.joined(separator: "\n"))
        }
        if !questions.isEmpty {
            parts.append("**Questions:**\n" + questions.map { "- \($0)" }.joined(separator: "\n"))
        }
        return parts.joined(separator: "\n\n")
    }
}

struct MockReviewInput {
    var content: String = ""
    var reviewerCount: Int = 3
    var strictness: MockStrictness = .balanced
}

func countVerdicts(_ results: [MockReviewerResult]) -> [MockReviewVerdict: Int] {
    var counts: [MockReviewVerdict: Int] = [.accept: 0, .minorRevision: 0, .majorRevision: 0, .reject: 0]
    for r in results { counts[r.verdict, default: 0] += 1 }
    return counts
}

func dominantVerdict(_ results: [MockReviewerResult]) -> MockReviewVerdict? {
    guard !results.isEmpty else { return nil }
    let counts = countVerdicts(results)
    return counts.max { $0.value < $1.value }?.key
}
