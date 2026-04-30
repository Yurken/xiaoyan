import Foundation
import GRDB

struct Venue: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var type: String
    var name: String
    var fullName: String?
    var website: String?
    var ccfRating: String?
    var area: String?
    var starred: Bool?
    var ei: Bool?
    var sci: Bool?
    var sciQuartile: String?
    var deadline: Date?
    var notificationDate: Date?
    var specialIssueTitle: String?
    var specialIssueDeadline: Date?
    var specialIssueDescription: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, type, name, website, area, starred, ei, sci, deadline
        case fullName = "full_name"
        case ccfRating = "ccf"
        case sciQuartile = "sci_quartile"
        case notificationDate = "notification_date"
        case specialIssueTitle = "special_issue_title"
        case specialIssueDeadline = "special_issue_deadline"
        case specialIssueDescription = "special_issue_description"
        case createdAt = "created_at"
    }
}

struct Submission: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var title: String
    var venueName: String?
    var venueType: String?
    var status: SubmissionStatus?
    var deadline: Date?
    var submittedAt: Date?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, title, status, deadline
        case venueName = "venue_name"
        case venueType = "venue_type"
        case submittedAt = "submitted_at"
        case createdAt = "created_at"
    }
}

enum SubmissionStatus: String, Codable {
    case draft, preparing, submitted, revision, accepted, rejected, withdrawn

    var displayName: String {
        switch self {
        case .draft: return "草稿"
        case .preparing: return "准备中"
        case .submitted: return "已提交"
        case .revision: return "修改中"
        case .accepted: return "已接收"
        case .rejected: return "已拒稿"
        case .withdrawn: return "已撤回"
        }
    }
}

struct PaperVersion: Codable, Identifiable, FetchableRecord {
    let id: String
    var submissionId: String
    var tag: String?
    var label: String?
    var stage: String?
    var content: String?
    var notes: String?
    var filePath: String?
    var fileName: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, tag, label, stage, content, notes
        case submissionId = "submission_id"
        case filePath = "file_path"
        case fileName = "file_name"
        case createdAt = "created_at"
    }
}

struct ReviewRound: Codable, Identifiable, Hashable, FetchableRecord {
    let id: String
    var submissionId: String
    var round: Int
    var verdict: String?
    var receivedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, round, verdict
        case submissionId = "submission_id"
        case receivedAt = "received_at"
    }
}

struct ReviewComment: Codable, Identifiable, FetchableRecord {
    let id: String
    var submissionId: String
    var round: Int
    var reviewer: String?
    var content: String
    var response: String?
    var resolved: Bool?
    var tags: [String]?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, round, reviewer, content, response, resolved, tags
        case submissionId = "submission_id"
        case createdAt = "created_at"
    }
}

struct SubmissionChecklistItem: Codable, Identifiable, FetchableRecord {
    let id: String
    var submissionId: String
    var label: String
    var checked: Bool?
    var category: String?
    var sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id, label, checked, category
        case submissionId = "submission_id"
        case sortOrder = "sort_order"
    }
}
