import SwiftUI

struct VersionsView: View {
    let service: SubmissionService
    @State private var submissions: [Submission] = []
    @State private var selectedSubmission: Submission?
    @State private var versions: [PaperVersion] = []
    @State private var showingCreate = false
    @State private var diffMode = false
    @State private var selectedForDiff: Set<String> = []
    @State private var diffPair: DiffPair?

    struct DiffPair: Identifiable {
        let id = UUID()
        let old: PaperVersion
        let new: PaperVersion
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
                        if diffMode {
                            Button("对比") {
                                prepareDiff()
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                            .disabled(selectedForDiff.count != 2)
                            Button("取消") {
                                diffMode = false
                                selectedForDiff.removeAll()
                            }
                            .controlSize(.small)
                        } else {
                            Button("版本对比") {
                                diffMode = true
                                selectedForDiff.removeAll()
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                            .disabled(versions.count < 2)
                            Button("新增版本") { showingCreate = true }
                                .controlSize(.small)
                        }
                    }
                    .padding()

                    if versions.isEmpty {
                        ContentUnavailableView("暂无版本", systemImage: "doc")
                    } else {
                        List {
                            ForEach(versions) { version in
                                VersionRow(
                                    version: version,
                                    service: service,
                                    diffMode: diffMode,
                                    isSelectedForDiff: selectedForDiff.contains(version.id),
                                    onToggleDiff: { toggleDiffSelection(version.id) },
                                    onReload: loadVersions
                                )
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
        .onChange(of: selectedSubmission?.id) { _, _ in
            loadVersions()
            diffMode = false
            selectedForDiff.removeAll()
            diffPair = nil
        }
        .sheet(isPresented: $showingCreate) {
            CreateVersionSheet(service: service, submissionId: selectedSubmission?.id ?? "", onCreated: loadVersions)
        }
        .sheet(item: $diffPair) { pair in
            VersionDiffView(oldVersion: pair.old, newVersion: pair.new)
        }
    }

    private func reload() {
        submissions = service.listSubmissions()
    }

    private func loadVersions() {
        guard let subId = selectedSubmission?.id else { versions = []; return }
        versions = service.listVersions(submissionId: subId)
    }

    private func toggleDiffSelection(_ id: String) {
        if selectedForDiff.contains(id) {
            selectedForDiff.remove(id)
        } else if selectedForDiff.count < 2 {
            selectedForDiff.insert(id)
        }
    }

    private func prepareDiff() {
        let selectedVersions = versions.filter { selectedForDiff.contains($0.id) }
        guard selectedVersions.count == 2 else { return }
        let sorted = selectedVersions.sorted { ($0.createdAt ?? Date.distantPast) < ($1.createdAt ?? Date.distantPast) }
        diffPair = DiffPair(old: sorted[0], new: sorted[1])
        diffMode = false
        selectedForDiff.removeAll()
    }
}

private struct VersionRow: View {
    let version: PaperVersion
    let service: SubmissionService
    let diffMode: Bool
    let isSelectedForDiff: Bool
    let onToggleDiff: () -> Void
    let onReload: () -> Void

    var body: some View {
        HStack {
            if diffMode {
                Image(systemName: isSelectedForDiff ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelectedForDiff ? .blue : .secondary)
                    .onTapGesture(perform: onToggleDiff)
            }

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

            Spacer()

            if !diffMode {
                Button("删除", role: .destructive) {
                    service.deleteVersion(id: version.id)
                    onReload()
                }
                .font(.caption)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            if diffMode {
                onToggleDiff()
            }
        }
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
