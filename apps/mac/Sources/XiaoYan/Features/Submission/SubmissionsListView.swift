import SwiftUI

struct SubmissionsListView: View {
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
            SubmissionStatusBadge(status: submission.status)
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

struct SubmissionStatusBadge: View {
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
