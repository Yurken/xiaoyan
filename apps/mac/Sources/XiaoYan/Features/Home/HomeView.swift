import SwiftUI

struct HomeView: View {
    @State private var paperCount = 0
    @State private var submissionCount = 0
    @State private var experimentCount = 0
    @State private var noteCount = 0
    @State private var recentPapers: [Paper] = []
    @State private var upcomingDeadlines: [Submission] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("欢迎回来")
                            .font(.title2.bold())
                        Text(Date(), style: .date)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }

                // Stats Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    StatCard(icon: "doc.text.fill", title: "论文", value: "\(paperCount)", color: .blue)
                    StatCard(icon: "paperplane.fill", title: "投稿", value: "\(submissionCount)", color: .green)
                    StatCard(icon: "flask.fill", title: "实验", value: "\(experimentCount)", color: .orange)
                    StatCard(icon: "note.text", title: "笔记", value: "\(noteCount)", color: .purple)
                }

                // Recent Papers
                if !recentPapers.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("最近论文")
                            .font(.headline)
                        ForEach(recentPapers.prefix(5)) { paper in
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundStyle(.secondary)
                                VStack(alignment: .leading) {
                                    Text(paper.title)
                                        .font(.subheadline)
                                        .lineLimit(1)
                                    if !paper.authors.isEmpty {
                                        Text(paper.authors.joined(separator: ", "))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(1)
                                    }
                                }
                                Spacer()
                                BadgeView(text: paper.status.rawValue, color: statusColor(paper.status))
                            }
                            .padding(8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                        }
                    }
                }

                // Upcoming Deadlines
                if !upcomingDeadlines.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("即将截止")
                            .font(.headline)
                        ForEach(upcomingDeadlines.prefix(5)) { sub in
                            HStack {
                                Image(systemName: "clock.fill")
                                    .foregroundStyle(.red)
                                VStack(alignment: .leading) {
                                    Text(sub.title)
                                        .font(.subheadline)
                                        .lineLimit(1)
                                    if let deadline = sub.deadline {
                                        Text(deadline, style: .date)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                            }
                            .padding(8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                        }
                    }
                }

                // Quick Actions
                VStack(alignment: .leading, spacing: 8) {
                    Text("快捷操作")
                        .font(.headline)
                    HStack(spacing: 12) {
                        QuickAction(icon: "plus.circle", title: "上传论文")
                        QuickAction(icon: "bubble.left", title: "对话小妍")
                        QuickAction(icon: "magnifyingglass", title: "搜索论文")
                        QuickAction(icon: "wrench", title: "工具箱")
                    }
                }
            }
            .padding()
        }
        .navigationTitle("首页")
        .onAppear(perform: loadData)
    }

    private func loadData() {
        let paperRepo = PaperRepository()
        let subRepo = SubmissionRepository()
        let expRepo = ExperimentRepository()
        let knRepo = KnowledgeRepository()

        paperCount = (try? paperRepo.list().count) ?? 0
        submissionCount = (try? subRepo.listSubmissions().count) ?? 0
        experimentCount = (try? expRepo.list().count) ?? 0
        noteCount = (try? knRepo.listNotes().count) ?? 0
        recentPapers = (try? paperRepo.list()) ?? []
        upcomingDeadlines = ((try? subRepo.listSubmissions()) ?? [])
            .filter { $0.deadline != nil }
            .sorted { ($0.deadline ?? .distantFuture) < ($1.deadline ?? .distantFuture) }
    }

    private func statusColor(_ status: PaperStatus) -> Color {
        switch status {
        case .uploaded: return .orange
        case .parsing: return .blue
        case .parsed: return .green
        case .failed: return .red
        case .analyzed: return .purple
        }
    }
}

private struct StatCard: View {
    let icon: String
    let title: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Spacer()
            }
            Text(value)
                .font(.title.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(12)
    }
}

private struct QuickAction: View {
    let icon: String
    let title: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
            Text(title)
                .font(.caption2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }
}
