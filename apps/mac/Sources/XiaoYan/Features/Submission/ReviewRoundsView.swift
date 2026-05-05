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
                        let derived = round.verdict ?? dominantVerdict(for: round)
                        if let verdict = derived {
                            Text(verdictLabel(verdict))
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
                                CommentRow(comment: comment, onUpdate: updateComment)
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

    private func updateComment(_ comment: ReviewComment) {
        service.updateReviewComment(comment)
        loadComments()
    }

    private func dominantVerdict(for round: ReviewRound) -> String? {
        let roundComments = comments.filter { $0.round == round.round }
        let verdicts = roundComments.compactMap { $0.verdict }.filter { !$0.isEmpty }
        guard !verdicts.isEmpty else { return nil }
        let counts = verdicts.reduce(into: [:]) { $0[$1, default: 0] += 1 }
        let sorted = counts.sorted { $0.value > $1.value }
        return sorted.first?.key
    }
}

private func normalizeVerdict(_ verdict: String) -> String {
    let lower = verdict.lowercased()
    if lower.contains("accept") { return "接收" }
    if lower.contains("reject") { return "拒稿" }
    if lower.contains("revision") { return "修改" }
    return verdict
}

private func verdictLabel(_ verdict: String) -> String {
    switch verdict.lowercased() {
    case "accept": return "接收"
    case "minor_revision": return "小修"
    case "major_revision": return "大修"
    case "reject": return "拒稿"
    default: return verdict
    }
}

private func verdictColor(_ verdict: String) -> Color {
    let lower = verdict.lowercased()
    if lower.contains("accept") || lower.contains("接收") { return .green }
    if lower.contains("reject") || lower.contains("拒稿") { return .red }
    if lower.contains("revision") || lower.contains("修改") { return .orange }
    return .blue
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
    let onUpdate: (ReviewComment) -> Void
    @State private var isExpanded = false
    @State private var editingResponse = false
    @State private var draftResponse = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(comment.reviewer ?? "匿名审稿人")
                    .font(.subheadline.bold())
                if let verdict = comment.verdict, !verdict.isEmpty {
                    Text(verdictLabel(verdict))
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(verdictColor(verdict).opacity(0.15))
                        .foregroundColor(verdictColor(verdict))
                        .cornerRadius(4)
                }
                Spacer()
                if let tags = comment.tags, !tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.1))
                                .foregroundColor(.accentColor)
                                .cornerRadius(4)
                        }
                    }
                }
                Button {
                    var updated = comment
                    updated.resolved = !(comment.resolved ?? false)
                    onUpdate(updated)
                } label: {
                    Image(systemName: (comment.resolved ?? false) ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle((comment.resolved ?? false) ? .green : .secondary)
                }
                .buttonStyle(.plain)
                .help((comment.resolved ?? false) ? "标记为未处理" : "标记为已处理")
            }
            Text(comment.content)
                .font(.body)
                .lineLimit(isExpanded ? nil : 3)
                .contentShape(Rectangle())
                .onTapGesture { isExpanded.toggle() }

            if editingResponse {
                HStack(spacing: 8) {
                    TextField("作者回复...", text: $draftResponse, axis: .vertical)
                        .lineLimit(2...6)
                    Button {
                        var updated = comment
                        updated.response = draftResponse.isEmpty ? nil : draftResponse
                        onUpdate(updated)
                        editingResponse = false
                    } label: {
                        Image(systemName: "checkmark")
                    }
                    .buttonStyle(.plain)
                    Button {
                        editingResponse = false
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .buttonStyle(.plain)
                }
            } else if let response = comment.response, !response.isEmpty {
                HStack(spacing: 4) {
                    Text("回复: \(response)")
                        .font(.caption)
                        .foregroundStyle(.blue)
                    Spacer()
                    Button {
                        draftResponse = response
                        editingResponse = true
                    } label: {
                        Image(systemName: "pencil")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Button {
                    draftResponse = ""
                    editingResponse = true
                } label: {
                    Text("添加回复...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
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
    @State private var tagsText = ""
    @State private var verdict = ""

    private let verdictOptions = ["accept", "minor_revision", "major_revision", "reject"]

    var body: some View {
        VStack(spacing: 16) {
            Text("添加审稿意见")
                .font(.headline)

            Form {
                TextField("审稿人", text: $reviewer)
                TextField("意见内容", text: $content, axis: .vertical)
                    .lineLimit(4...10)
                Picker("审稿结论", selection: $verdict) {
                    Text("请选择").tag("")
                    ForEach(verdictOptions, id: \.self) { v in
                        Text(verdictLabel(v)).tag(v)
                    }
                }
                .pickerStyle(.menu)
                TextField("标签（用逗号分隔，如：方法, 实验, 写作）", text: $tagsText)
                TextField("回复 (可选)", text: $response, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("添加") {
                    let tags = tagsText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    let comment = ReviewComment(
                        id: UUID().uuidString,
                        submissionId: submissionId,
                        round: round,
                        reviewer: reviewer.isEmpty ? nil : reviewer,
                        content: content,
                        response: response.isEmpty ? nil : response,
                        resolved: false,
                        tags: tags.isEmpty ? nil : tags,
                        verdict: verdict.isEmpty ? nil : verdict,
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
        .frame(width: 460, height: 480)
    }

    private func verdictLabel(_ verdict: String) -> String {
        switch verdict {
        case "accept": return "接收"
        case "minor_revision": return "小修"
        case "major_revision": return "大修"
        case "reject": return "拒稿"
        default: return verdict
        }
    }
}
