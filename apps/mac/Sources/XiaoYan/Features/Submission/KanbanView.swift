import SwiftUI

struct KanbanView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []

    private let columns: [(status: SubmissionStatus, title: String, color: Color)] = [
        (.writing, "撰写中", Color.purple),
        (.submitted, "已投稿", Color.blue),
        (.reviewing, "审稿中", Color.orange),
        (.accepted, "已接收", Color.green),
        (.rejected, "已拒绝", Color.gray),
    ]

    var body: some View {
        ScrollView(.horizontal) {
            HStack(alignment: .top, spacing: 12) {
                ForEach(columns, id: \.status) { column in
                    KanbanColumn(
                        title: column.title,
                        color: column.color,
                        submissions: submissions.filter { $0.status == column.status },
                        service: service,
                        onUpdate: reload
                    )
                }
            }
            .padding()
        }
        .onAppear(perform: reload)
    }

    private func reload() {
        submissions = service.listSubmissions()
    }
}

private struct KanbanColumn: View {
    let title: String
    let color: Color
    let submissions: [Submission]
    let service: SubmissionService
    let onUpdate: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text(title)
                    .font(.subheadline.bold())
                Text("\(submissions.count)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(10)
            .background(color.opacity(0.08))

            // Cards
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(submissions) { sub in
                        KanbanCard(submission: sub, service: service, onUpdate: onUpdate)
                    }
                }
                .padding(8)
            }
        }
        .frame(width: 220)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}

private struct KanbanCard: View {
    let submission: Submission
    let service: SubmissionService
    let onUpdate: () -> Void
    @State private var showingMoveMenu = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(submission.title)
                .font(.caption.bold())
                .lineLimit(2)

            HStack(spacing: 4) {
                if let venue = submission.venueName {
                    Label(venue, systemImage: "building.2")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
            }

            if let deadline = submission.deadline {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.caption2)
                    Text(deadline, style: .date)
                        .font(.caption2)
                }
                .foregroundStyle(deadline < Date() ? .red : .secondary)
            }

            HStack {
                Spacer()
                Menu {
                    ForEach(SubmissionStatus.allCases, id: \.self) { status in
                        Button("移至 \(status.displayName)") { move(to: status) }
                    }
                } label: {
                    Image(systemName: "arrow.right.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .menuStyle(.borderlessButton)
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    private func move(to status: SubmissionStatus) {
        var updated = submission
        updated.status = status
        if status == .submitted && submission.submittedAt == nil {
            updated.submittedAt = Date()
        }
        service.updateSubmission(updated)
        onUpdate()
    }
}
