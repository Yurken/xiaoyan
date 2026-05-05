import Foundation
import GRDB

struct SubmissionRepository {
    let dbQueue: DatabaseQueue = DatabaseManager.shared.dbQueue

    // Venues
    func listVenues(starred: Bool? = nil) throws -> [Venue] {
        try dbQueue.read { db in
            var sql = "SELECT * FROM venues"
            if let starred {
                sql += starred ? " WHERE starred = 1" : " WHERE starred = 0 OR starred IS NULL"
            }
            sql += " ORDER BY created_at DESC"
            return try Venue.fetchAll(db, sql: sql)
        }
    }

    func createVenue(_ venue: Venue) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO venues (id, type, name, full_name, website, ccf, area, starred,
                        ei, sci, sci_quartile, deadline, notification_date,
                        special_issue_title, special_issue_deadline, special_issue_description)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                arguments: [
                    venue.id, venue.type, venue.name, venue.fullName, venue.website,
                    venue.ccfRating, venue.area, venue.starred ?? false,
                    venue.ei, venue.sci, venue.sciQuartile,
                    venue.deadline, venue.notificationDate,
                    venue.specialIssueTitle, venue.specialIssueDeadline, venue.specialIssueDescription
                ]
            )
        }
    }

    func updateVenue(_ venue: Venue) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE venues SET type=?, name=?, full_name=?, website=?, ccf=?, area=?,
                        starred=?, ei=?, sci=?, sci_quartile=?, deadline=?, notification_date=?,
                        special_issue_title=?, special_issue_deadline=?, special_issue_description=?
                    WHERE id=?
                """,
                arguments: [
                    venue.type, venue.name, venue.fullName, venue.website,
                    venue.ccfRating, venue.area, venue.starred ?? false,
                    venue.ei, venue.sci, venue.sciQuartile,
                    venue.deadline, venue.notificationDate,
                    venue.specialIssueTitle, venue.specialIssueDeadline, venue.specialIssueDescription,
                    venue.id
                ]
            )
        }
    }

    func deleteVenue(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM venues WHERE id = ?", arguments: [id])
        }
    }

    func toggleVenueStar(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "UPDATE venues SET starred = NOT starred WHERE id = ?", arguments: [id])
        }
    }

    // Submissions
    func listSubmissions() throws -> [Submission] {
        try dbQueue.read { db in
            try Submission.fetchAll(db, sql: "SELECT * FROM submissions ORDER BY created_at DESC")
        }
    }

    func createSubmission(_ submission: Submission) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO submissions (id, title, venue_name, venue_type, status, deadline) VALUES (?,?,?,?,?,?)",
                arguments: [submission.id, submission.title, submission.venueName, submission.venueType, submission.status?.rawValue, submission.deadline]
            )
        }
    }

    func updateSubmission(_ submission: Submission) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE submissions SET title=?, venue_name=?, venue_type=?, status=?, deadline=?, submitted_at=? WHERE id=?",
                arguments: [
                    submission.title, submission.venueName, submission.venueType,
                    submission.status?.rawValue, submission.deadline, submission.submittedAt, submission.id
                ]
            )
        }
    }

    func deleteSubmission(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM submissions WHERE id = ?", arguments: [id])
        }
    }

    // Review
    func insertReviewRound(_ round: ReviewRound) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO review_rounds (id, submission_id, round, verdict, received_at) VALUES (?,?,?,?,?)",
                arguments: [round.id, round.submissionId, round.round, round.verdict, round.receivedAt]
            )
        }
    }

    func upsertReviewRound(_ round: ReviewRound) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO review_rounds (id, submission_id, round, verdict, received_at)
                    VALUES (?,?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET
                      verdict = excluded.verdict,
                      received_at = excluded.received_at
                """,
                arguments: [round.id, round.submissionId, round.round, round.verdict, round.receivedAt]
            )
        }
    }

    func insertReviewComment(_ comment: ReviewComment) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO review_comments (id, submission_id, round, reviewer, content, response, resolved, tags, verdict) VALUES (?,?,?,?,?,?,?,?,?)",
                arguments: [
                    comment.id, comment.submissionId, comment.round, comment.reviewer,
                    comment.content, comment.response, comment.resolved ?? false,
                    comment.tags?.jsonString, comment.verdict
                ]
            )
        }
    }

    func updateReviewComment(_ comment: ReviewComment) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "UPDATE review_comments SET reviewer=?, content=?, response=?, resolved=?, tags=?, verdict=? WHERE id=?",
                arguments: [
                    comment.reviewer, comment.content, comment.response, comment.resolved ?? false,
                    comment.tags?.jsonString, comment.verdict, comment.id
                ]
            )
        }
    }

    // Versions
    func listVersions(submissionId: String) throws -> [PaperVersion] {
        try dbQueue.read { db in
            try PaperVersion.fetchAll(db, sql: "SELECT * FROM paper_versions WHERE submission_id = ? ORDER BY created_at DESC", arguments: [submissionId])
        }
    }

    func insertVersion(_ version: PaperVersion) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO paper_versions (id, submission_id, tag, label, stage, content, notes, file_path, file_name) VALUES (?,?,?,?,?,?,?,?,?)",
                arguments: [
                    version.id, version.submissionId, version.tag, version.label,
                    version.stage, version.content, version.notes, version.filePath, version.fileName
                ]
            )
        }
    }

    func deleteVersion(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM paper_versions WHERE id = ?", arguments: [id])
        }
    }

    func updateVersion(_ version: PaperVersion) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE paper_versions
                    SET tag = ?, label = ?, stage = ?, content = ?, notes = ?,
                        file_path = ?, file_name = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """,
                arguments: [
                    version.tag, version.label, version.stage, version.content, version.notes,
                    version.filePath, version.fileName, version.id
                ]
            )
        }
    }

    // Review Rounds
    func listReviewRounds(submissionId: String) throws -> [ReviewRound] {
        try dbQueue.read { db in
            try ReviewRound.fetchAll(db, sql: "SELECT * FROM review_rounds WHERE submission_id = ? ORDER BY round ASC", arguments: [submissionId])
        }
    }

    func listReviewComments(submissionId: String, round: Int) throws -> [ReviewComment] {
        try dbQueue.read { db in
            try ReviewComment.fetchAll(db, sql: "SELECT * FROM review_comments WHERE submission_id = ? AND round = ? ORDER BY created_at ASC", arguments: [submissionId, round])
        }
    }

    func deleteReviewRound(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM review_rounds WHERE id = ?", arguments: [id])
            try db.execute(sql: "DELETE FROM review_comments WHERE id IN (SELECT id FROM review_comments WHERE round IN (SELECT round FROM review_rounds WHERE id = ?))", arguments: [id])
        }
    }

    // Stats
    struct SubmissionStats {
        let active: Int
        let pendingReviews: Int
        let upcomingDdls: [(name: String, deadline: Date)]
    }

    func stats() throws -> SubmissionStats {
        try dbQueue.read { db in
            let active = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM submissions WHERE status IN ('writing', 'submitted', 'reviewing')") ?? 0
            let pendingReviews = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM review_comments WHERE resolved = 0 OR resolved IS NULL") ?? 0
            let rows = try Row.fetchAll(db, sql: "SELECT venue_name, deadline FROM submissions WHERE deadline IS NOT NULL AND status IN ('writing', 'submitted', 'reviewing') ORDER BY deadline ASC LIMIT 5")
            let upcomingDdls = rows.compactMap { row -> (name: String, deadline: Date)? in
                guard let deadline = row["deadline"] as Date? else { return nil }
                return (name: row["venue_name"] as? String ?? "未命名", deadline: deadline)
            }
            return SubmissionStats(active: active, pendingReviews: pendingReviews, upcomingDdls: upcomingDdls)
        }
    }

    // Checklist
    func upsertChecklistItem(_ item: SubmissionChecklistItem) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "INSERT INTO submission_checklist (id, submission_id, label, checked, category, sort_order) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label, checked=excluded.checked, category=excluded.category, sort_order=excluded.sort_order",
                arguments: [item.id, item.submissionId, item.label, item.checked ?? false, item.category, item.sortOrder ?? 0]
            )
        }
    }

    func deleteChecklistItem(id: String) throws {
        try dbQueue.write { db in
            try db.execute(sql: "DELETE FROM submission_checklist WHERE id = ?", arguments: [id])
        }
    }
}

private extension Encodable {
    var jsonString: String {
        (try? JSONEncoder().encode(self)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
    }
}
