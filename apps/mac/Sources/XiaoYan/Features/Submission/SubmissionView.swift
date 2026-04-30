import SwiftUI

struct SubmissionView: View {
    @StateObject private var submissionService = SubmissionService()
    @State private var selectedTab: Tab = .submissions

    enum Tab: String, CaseIterable {
        case submissions = "投稿"
        case venues = "期刊/会议"
        case checklist = "清单"
        case versions = "版本"
        case reviewRounds = "审稿"
        case review = "AI 审稿"
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
            case .venues: VenuesListView(service: submissionService)
            case .checklist: ChecklistView(service: submissionService)
            case .versions: VersionsView(service: submissionService)
            case .reviewRounds: ReviewRoundsView(service: submissionService)
            case .review: AIReviewView(service: submissionService)
            }
        }
        .navigationTitle("投稿")
    }
}

// MARK: - Submissions List

private struct SubmissionsListView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var showingCreate = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("共 \(submissions.count) 个投稿")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("新建投稿") { showingCreate = true }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
            .padding(.horizontal)

            if submissions.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "paperplane")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("还没有投稿")
                        .font(.subheadline.bold())
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(submissions) { sub in
                    SubmissionRow(submission: sub, service: service, onReload: reload)
                }
                .listStyle(.plain)
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreate) {
            CreateSubmissionSheet(service: service, onCreated: reload)
        }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }
}

private struct SubmissionRow: View {
    let submission: Submission
    let service: SubmissionService
    let onReload: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(submission.title)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                HStack(spacing: 8) {
                    if let venue = submission.venueName {
                        Label(venue, systemImage: "building.2")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let deadline = submission.deadline {
                        Label(deadline.formatted(date: .abbreviated, time: .omitted), systemImage: "clock")
                            .font(.caption)
                            .foregroundStyle(deadline < Date() ? .red : .secondary)
                    }
                }
            }
            Spacer()
            StatusBadge(status: submission.status)
            Menu {
                ForEach([SubmissionStatus.draft, .preparing, .submitted, .revision, .accepted, .rejected, .withdrawn], id: \.self) { status in
                    Button(status.displayName) {
                        var updated = submission
                        updated.status = status
                        if status == .submitted && submission.submittedAt == nil {
                            updated.submittedAt = Date()
                        }
                        service.updateSubmission(updated)
                        onReload()
                    }
                }
                Divider()
                Button("删除", role: .destructive) {
                    service.deleteSubmission(id: submission.id)
                    onReload()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.secondary)
            }
            .menuStyle(.borderlessButton)
        }
        .padding(.vertical, 4)
    }
}

private struct StatusBadge: View {
    let status: SubmissionStatus?

    var body: some View {
        Text(status?.displayName ?? "未知")
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }

    private var color: Color {
        switch status {
        case .draft: return .gray
        case .preparing: return .orange
        case .submitted: return .blue
        case .revision: return .purple
        case .accepted: return .green
        case .rejected: return .red
        case .withdrawn: return .secondary
        case nil: return .gray
        }
    }
}

private extension SubmissionStatus {
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

// MARK: - Create Submission Sheet

private struct CreateSubmissionSheet: View {
    let service: SubmissionService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var venueName = ""
    @State private var hasDeadline = false
    @State private var deadline = Date().addingTimeInterval(30 * 86400)

    var body: some View {
        VStack(spacing: 16) {
            Text("新建投稿")
                .font(.headline)

            Form {
                TextField("论文标题", text: $title)
                TextField("期刊/会议名称", text: $venueName)
                Toggle("设置截止日期", isOn: $hasDeadline)
                if hasDeadline {
                    DatePicker("截止日期", selection: $deadline, displayedComponents: .date)
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    _ = service.createSubmission(
                        title: title,
                        venueName: venueName.isEmpty ? nil : venueName,
                        deadline: hasDeadline ? deadline : nil
                    )
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 400, height: 320)
    }
}

// MARK: - Venues List

private struct VenuesListView: View {
    let service: SubmissionService
    @State private var venues: [Venue] = []
    @State private var searchText = ""
    @State private var showingCreate = false

    var filteredVenues: [Venue] {
        if searchText.isEmpty { return venues }
        let q = searchText.lowercased()
        return venues.filter { $0.name.lowercased().contains(q) || ($0.fullName?.lowercased().contains(q) ?? false) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("搜索期刊/会议...", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                Spacer()
                Button("新建") { showingCreate = true }
                    .controlSize(.small)
            }
            .padding(.horizontal)

            List(filteredVenues) { venue in
                VenueRow(venue: venue, service: service, onReload: reload)
            }
            .listStyle(.plain)
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreate) {
            CreateVenueSheet(service: service, onCreated: reload)
        }
    }

    private func reload() {
        venues = service.listVenues()
    }
}

private struct VenueRow: View {
    let venue: Venue
    let service: SubmissionService
    let onReload: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(venue.name)
                        .font(.subheadline.bold())
                    if venue.starred == true {
                        Image(systemName: "star.fill")
                            .foregroundStyle(.yellow)
                            .font(.caption2)
                    }
                }
                if let fullName = venue.fullName {
                    Text(fullName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            HStack(spacing: 6) {
                if let ccf = venue.ccfRating {
                    Text("CCF \(ccf)")
                        .font(.caption2.bold())
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(ccfColor(ccf).opacity(0.15))
                        .foregroundColor(ccfColor(ccf))
                        .cornerRadius(4)
                }
                if let quartile = venue.sciQuartile {
                    Text(quartile)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                }
                if !venue.type.isEmpty {
                    Text(venue.type)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Menu {
                Button(venue.starred == true ? "取消收藏" : "收藏") {
                    service.toggleVenueStar(id: venue.id)
                    onReload()
                }
                Button("删除", role: .destructive) {
                    service.deleteVenue(id: venue.id)
                    onReload()
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.secondary)
            }
            .menuStyle(.borderlessButton)
        }
        .padding(.vertical, 2)
    }

    private func ccfColor(_ rating: String) -> Color {
        switch rating.uppercased() {
        case "A": return .red
        case "B": return .orange
        case "C": return .blue
        default: return .gray
        }
    }
}

// MARK: - Create Venue Sheet

private struct CreateVenueSheet: View {
    let service: SubmissionService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var fullName = ""
    @State private var type = "conference"
    @State private var ccfRating = ""
    @State private var area = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("新建期刊/会议")
                .font(.headline)

            Form {
                TextField("名称（缩写）", text: $name)
                TextField("全称", text: $fullName)
                Picker("类型", selection: $type) {
                    Text("会议").tag("conference")
                    Text("期刊").tag("journal")
                }
                TextField("CCF 等级 (A/B/C)", text: $ccfRating)
                TextField("领域", text: $area)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let venue = Venue(
                        id: UUID().uuidString,
                        type: type,
                        name: name,
                        fullName: fullName.isEmpty ? nil : fullName,
                        website: nil,
                        ccfRating: ccfRating.isEmpty ? nil : ccfRating.uppercased(),
                        area: area.isEmpty ? nil : area,
                        starred: false,
                        ei: nil, sci: nil, sciQuartile: nil,
                        deadline: nil, notificationDate: nil,
                        specialIssueTitle: nil, specialIssueDeadline: nil, specialIssueDescription: nil,
                        createdAt: Date()
                    )
                    service.createVenue(venue)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 420, height: 360)
    }
}

// MARK: - Checklist

private struct ChecklistView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var items: [SubmissionChecklistItem] = []
    @State private var newItemLabel = ""

    var body: some View {
        HStack(spacing: 0) {
            // Submission picker
            List(submissions, selection: $selectedSubmission) { sub in
                Text(sub.title)
                    .font(.subheadline)
                    .lineLimit(1)
                    .tag(sub)
            }
            .listStyle(.sidebar)
            .frame(width: 200)

            Divider()

            // Checklist
            VStack(spacing: 0) {
                if let sub = selectedSubmission {
                    HStack {
                        Text(sub.title)
                            .font(.headline)
                        Spacer()
                    }
                    .padding()

                    List {
                        ForEach(items) { item in
                            HStack {
                                Button(action: { toggleItem(item) }) {
                                    Image(systemName: (item.checked ?? false) ? "checkmark.square" : "square")
                                        .foregroundStyle((item.checked ?? false) ? .green : .secondary)
                                }
                                .buttonStyle(.plain)
                                Text(item.label)
                                    .strikethrough(item.checked ?? false)
                                    .foregroundStyle((item.checked ?? false) ? .secondary : .primary)
                                Spacer()
                                Button(action: { deleteItem(item) }) {
                                    Image(systemName: "trash")
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        HStack {
                            TextField("添加检查项...", text: $newItemLabel)
                                .textFieldStyle(.roundedBorder)
                                .onSubmit(addItem)
                            Button("添加", action: addItem)
                                .disabled(newItemLabel.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .listStyle(.plain)
                } else {
                    ContentUnavailableView("选择投稿", systemImage: "checklist")
                }
            }
        }
        .onAppear(perform: reload)
        .onChange(of: selectedSubmission?.id) { _, _ in loadItems() }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func loadItems() {
        guard let subId = selectedSubmission?.id else { items = []; return }
        items = (try? DatabaseManager.shared.dbQueue.read { db in
            try SubmissionChecklistItem.fetchAll(db, sql: "SELECT * FROM submission_checklist WHERE submission_id = ? ORDER BY sort_order", arguments: [subId])
        }) ?? []
    }

    private func toggleItem(_ item: SubmissionChecklistItem) {
        var updated = item
        updated.checked = !(item.checked ?? false)
        service.upsertChecklistItem(updated)
        loadItems()
    }

    private func deleteItem(_ item: SubmissionChecklistItem) {
        try? SubmissionRepository().deleteChecklistItem(id: item.id)
        loadItems()
    }

    private func addItem() {
        guard let subId = selectedSubmission?.id,
              !newItemLabel.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let item = SubmissionChecklistItem(
            id: UUID().uuidString,
            submissionId: subId,
            label: newItemLabel,
            checked: false,
            category: nil,
            sortOrder: items.count
        )
        service.upsertChecklistItem(item)
        newItemLabel = ""
        loadItems()
    }
}

// MARK: - AI Review

private struct AIReviewView: View {
    let service: SubmissionService
    @EnvironmentObject var settings: AppSettings
    @State private var content = ""
    @State private var reviewResult = ""
    @State private var isReviewing = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                // Input
                VStack(alignment: .leading, spacing: 8) {
                    Text("论文内容")
                        .font(.headline)
                    TextEditor(text: $content)
                        .font(.body)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                }

                // Output
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("AI 审稿意见")
                            .font(.headline)
                        Spacer()
                        if !reviewResult.isEmpty {
                            Button("复制") {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(reviewResult, forType: .string)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }

                    ScrollView {
                        Text(reviewResult.isEmpty ? "粘贴论文内容后点击「开始审稿」" : reviewResult)
                            .font(.body)
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                    }
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                }
            }
            .padding()

            HStack {
                Spacer()
                Button(action: startReview) {
                    if isReviewing {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("审稿中...")
                        }
                    } else {
                        Text("开始审稿")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(content.trimmingCharacters(in: .whitespaces).isEmpty || isReviewing)
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
    }

    private func startReview() {
        guard !content.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isReviewing = true
        reviewResult = ""

        Task {
            let stream = service.runAIReview(submissionId: "", content: content, settings: settings)
            do {
                for try await chunk in stream {
                    reviewResult += chunk
                }
            } catch {
                if reviewResult.isEmpty {
                    reviewResult = "审稿失败: \(error.localizedDescription)"
                }
            }
            isReviewing = false
        }
    }
}

// MARK: - Versions

private struct VersionsView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var versions: [PaperVersion] = []
    @State private var showingCreate = false

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
                        Button("新增版本") { showingCreate = true }
                            .controlSize(.small)
                    }
                    .padding()

                    if versions.isEmpty {
                        ContentUnavailableView("暂无版本", systemImage: "doc")
                    } else {
                        List {
                            ForEach(versions) { version in
                                VersionRow(version: version, service: service, onReload: loadVersions)
                            }
                        }
                        .listStyle(.plain)
                    }
                } else {
                    ContentUnavailableView("选择投稿", systemImage: "doc.text")
                }
            }
        }
        .onAppear(perform: reload)
        .onChange(of: selectedSubmission?.id) { _, _ in loadVersions() }
        .sheet(isPresented: $showingCreate) {
            CreateVersionSheet(service: service, submissionId: selectedSubmission?.id ?? "", onCreated: loadVersions)
        }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func loadVersions() {
        guard let subId = selectedSubmission?.id else { versions = []; return }
        versions = service.listVersions(submissionId: subId)
    }
}

private struct VersionRow: View {
    let version: PaperVersion
    let service: SubmissionService
    let onReload: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(version.tag ?? "未命名")
                    .font(.subheadline.bold())
                if let label = version.label {
                    Text(label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let stage = version.stage {
                    Text(stage)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                }
                Button("删除", role: .destructive) {
                    service.deleteVersion(id: version.id)
                    onReload()
                }
                .font(.caption)
            }
            if let notes = version.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let date = version.createdAt {
                Text(date, style: .date)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct CreateVersionSheet: View {
    let service: SubmissionService
    let submissionId: String
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var tag = ""
    @State private var label = ""
    @State private var stage = "draft"
    @State private var notes = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("新增版本")
                .font(.headline)

            Form {
                TextField("版本标签 (如 v1.0)", text: $tag)
                TextField("版本说明", text: $label)
                Picker("阶段", selection: $stage) {
                    Text("草稿").tag("draft")
                    Text("初稿").tag("first draft")
                    Text("修改稿").tag("revision")
                    Text("终稿").tag("final")
                }
                TextField("备注", text: $notes, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    service.createVersion(
                        submissionId: submissionId,
                        tag: tag,
                        label: label.isEmpty ? nil : label,
                        stage: stage,
                        content: nil,
                        notes: notes.isEmpty ? nil : notes
                    )
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(tag.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 400, height: 300)
    }
}

// MARK: - Review Rounds

private struct ReviewRoundsView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var rounds: [ReviewRound] = []
    @State private var comments: [ReviewComment] = []
    @State private var selectedRound: ReviewRound?
    @State private var showingCreateRound = false
    @State private var showingAddComment = false

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

    private func verdictColor(_ verdict: String) -> Color {
        switch verdict.lowercased() {
        case "accept", "accepted", "接收": return .green
        case "reject", "rejected", "拒稿": return .red
        case "revision", "major revision", "minor revision", "修改": return .orange
        default: return .blue
        }
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
