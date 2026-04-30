import SwiftUI

struct ReviewRoundsView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var rounds: [ReviewRound] = []
    @State private var comments: [ReviewComment] = []
    @State private var selectedRound: ReviewRound?
    @State private var showingCreateRound = false
    @State private var showingAddComment = false

    var verdictStats: [String: Int] {
        var stats: [String: Int] = [:]
        for round in rounds {
            if let verdict = round.verdict, !verdict.isEmpty {
                let key = normalizeVerdict(verdict)
                stats[key, default: 0] += 1
            }
        }
        return stats
    }

    var body: some View {
        HStack(spacing: 0) {
            List(submissions, selection: $selectedSubmission) { sub in
                Text(sub.title)
                    .font(.subheadline)
                    .lineLimit(1)
                    .tag(sub)
            }
            .listStyle(.sidebar)
            .frame(width: 200)

            Divider()

            VStack(spacing: 0) {
                if let sub = selectedSubmission {
                    HStack {
                        Text(sub.title)
                            .font(.headline)
                        Spacer()
                        Button("新增审稿轮次") { showingCreateRound = true }
                            .controlSize(.small)
                    }
                    .padding()

                    if !verdictStats.isEmpty {
                        HStack(spacing: 12) {
                            ForEach(Array(verdictStats.keys.sorted()), id: \.self) { key in
                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(verdictColor(key))
                                        .frame(width: 8, height: 8)
                                    Text("\(key): \(verdictStats[key] ?? 0)")
                                        .font(.caption)
                                }
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(verdictColor(key).opacity(0.08))
                                .cornerRadius(6)
                            }
                            Spacer()
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 8)
                    }

                    if rounds.isEmpty {
                        ContentUnavailableView("暂无审稿记录", systemImage: "envelope")
                    } else {
                        List(rounds, selection: $selectedRound) { round in
                            RoundRow(round: round)
                                .tag(round)
                        }
                        .listStyle(.plain)
                    }
                } else {
                    ContentUnavailableView("选择投稿", systemImage: "doc.text")
                }
            }
            .frame(minWidth: 200)

            if let round = selectedRound {
                Divider()

                VStack(spacing: 0) {
                    HStack {
                        Text("第 \(round.round) 轮审稿")
                            .font(.headline)
                        Spacer()
                        if let verdict = round.verdict {
                            Text(verdict)
                                .font(.caption2.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(verdictColor(verdict).opacity(0.15))
                                .foregroundColor(verdictColor(verdict))
                                .cornerRadius(4)
                        }
                        Button("添加审稿意见") { showingAddComment = true }
                            .controlSize(.small)
                    }
                    .padding()

                    if comments.isEmpty {
                        ContentUnavailableView("暂无审稿意见", systemImage: "bubble.left")
                    } else {
                        List {
                            ForEach(comments) { comment in
                                CommentRow(comment: comment)
                            }
                        }
                        .listStyle(.plain)
                    }
                }
                .frame(minWidth: 300)
                .onAppear { loadComments() }
                .onChange(of: selectedRound?.id) { _, _ in loadComments() }
            }
        }
        .onAppear(perform: reload)
        .onChange(of: selectedSubmission?.id) { _, _ in loadRounds() }
        .sheet(isPresented: $showingCreateRound) {
            CreateRoundSheet(service: service, submissionId: selectedSubmission?.id ?? "", nextRound: (rounds.max(by: { $0.round < $1.round })?.round ?? 0) + 1, onCreated: loadRounds)
        }
        .sheet(isPresented: $showingAddComment) {
            AddCommentSheet(service: service, submissionId: selectedSubmission?.id ?? "", round: selectedRound?.round ?? 1, onCreated: loadComments)
        }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func loadRounds() {
        guard let subId = selectedSubmission?.id else { rounds = []; return }
        rounds = service.listReviewRounds(submissionId: subId)
        selectedRound = rounds.first
        loadComments()
    }

    private func loadComments() {
        guard let subId = selectedSubmission?.id, let round = selectedRound?.round else { comments = []; return }
        comments = service.listReviewComments(submissionId: subId, round: round)
    }

    private func normalizeVerdict(_ verdict: String) -> String {
        let lower = verdict.lowercased()
        if lower.contains("accept") { return "接收" }
        if lower.contains("reject") { return "拒稿" }
        if lower.contains("revision") { return "修改" }
        return verdict
    }

    private func verdictColor(_ verdict: String) -> Color {
        let lower = verdict.lowercased()
        if lower.contains("accept") || lower.contains("接收") { return .green }
        if lower.contains("reject") || lower.contains("拒稿") { return .red }
        if lower.contains("revision") || lower.contains("修改") { return .orange }
        return .blue
    }
}

private struct RoundRow: View {
    let round: ReviewRound

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("第 \(round.round) 轮")
                    .font(.subheadline.bold())
                if let received = round.receivedAt {
                    Text(received, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let verdict = round.verdict {
                Text(verdict)
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(
                        (verdict.lowercased().contains("accept") ? Color.green :
                         verdict.lowercased().contains("reject") ? Color.red : Color.orange)
                        .opacity(0.15)
                    )
                    .foregroundColor(
                        verdict.lowercased().contains("accept") ? .green :
                        verdict.lowercased().contains("reject") ? .red : .orange
                    )
                    .cornerRadius(4)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct CommentRow: View {
    let comment: ReviewComment
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(comment.reviewer ?? "匿名审稿人")
                    .font(.subheadline.bold())
                Spacer()
                if comment.resolved == true {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                }
            }
            Text(comment.content)
                .font(.body)
                .lineLimit(isExpanded ? nil : 3)
            if let response = comment.response, !response.isEmpty {
                Text("回复: \(response)")
                    .font(.caption)
                    .foregroundStyle(.blue)
                    .padding(.top, 2)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture { isExpanded.toggle() }
    }
}

private struct CreateRoundSheet: View {
    let service: SubmissionService
    let submissionId: String
    let nextRound: Int
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var verdict = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("新增第 \(nextRound) 轮审稿")
                .font(.headline)

            Form {
                TextField("审稿结果 (如 Accept / Revision / Reject)", text: $verdict)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    service.createReviewRound(
                        submissionId: submissionId,
                        round: nextRound,
                        verdict: verdict.isEmpty ? nil : verdict
                    )
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 380, height: 200)
    }
}

private struct AddCommentSheet: View {
    let service: SubmissionService
    let submissionId: String
    let round: Int
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var reviewer = ""
    @State private var content = ""
    @State private var response = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("添加审稿意见")
                .font(.headline)

            Form {
                TextField("审稿人", text: $reviewer)
                TextField("意见内容", text: $content, axis: .vertical)
                    .lineLimit(4...10)
                TextField("回复 (可选)", text: $response, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("添加") {
                    let comment = ReviewComment(
                        id: UUID().uuidString,
                        submissionId: submissionId,
                        round: round,
                        reviewer: reviewer.isEmpty ? nil : reviewer,
                        content: content,
                        response: response.isEmpty ? nil : response,
                        resolved: false,
                        tags: nil,
                        createdAt: Date()
                    )
                    service.addReviewComment(comment)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(content.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 460, height: 380)
    }
}
