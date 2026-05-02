import SwiftUI

struct ExperimentView: View {
    @StateObject private var experimentRepo = ExperimentRepo()
    @State private var experiments: [ExperimentRecord] = []
    @State private var selectedExperiment: ExperimentRecord?
    @State private var showingCreateSheet = false

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                if experiments.isEmpty {
                    emptyState
                } else {
                    List(experiments, selection: $selectedExperiment) { exp in
                        ExperimentRow(experiment: exp)
                            .tag(exp)
                            .contextMenu {
                                Button("删除", role: .destructive) {
                                    experimentRepo.delete(id: exp.id)
                                    reload()
                                }
                            }
                    }
                    .listStyle(.sidebar)
                }
            }
            .navigationTitle("实验")
            .toolbar {
                ToolbarItem {
                    Button(action: { showingCreateSheet = true }) {
                        Label("新建实验", systemImage: "plus")
                    }
                }
            }
        } detail: {
            if let exp = selectedExperiment {
                ExperimentDetailView(experiment: exp, onUpdate: reload)
            } else {
                ContentUnavailableView("选择实验", systemImage: "flask")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreateSheet) {
            CreateExperimentSheet(onCreated: { _ in reload() })
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "flask.fill")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("还没有实验记录")
                .font(.title3.bold())
            Text("创建实验来跟踪配置与结果")
                .foregroundStyle(.secondary)
            Button("创建实验") { showingCreateSheet = true }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func reload() {
        experiments = experimentRepo.list()
        if let selected = selectedExperiment {
            selectedExperiment = experiments.first { $0.id == selected.id }
        }
    }
}

// MARK: - Repository Wrapper

@MainActor
private final class ExperimentRepo: ObservableObject {
    private let repo = ExperimentRepository()

    func list() -> [ExperimentRecord] {
        (try? repo.list()) ?? []
    }

    func delete(id: String) {
        try? repo.delete(id: id)
    }
}

// MARK: - Row

private struct ExperimentRow: View {
    let experiment: ExperimentRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(experiment.title)
                .font(.subheadline.bold())
            HStack(spacing: 8) {
                if experiment.linkedSubmissionId != nil {
                    Label("已关联投稿", systemImage: "link")
                        .font(.caption2)
                        .foregroundStyle(.blue)
                }
                if let date = experiment.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Detail View

private struct ExperimentDetailView: View {
    let experiment: ExperimentRecord
    let onUpdate: () -> Void

    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editConfigText = ""
    @State private var editResultText = ""
    @State private var editNotes = ""
    @State private var configError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Title
                HStack {
                    if isEditing {
                        TextField("实验标题", text: $editTitle)
                            .font(.title2.bold())
                            .textFieldStyle(.plain)
                    } else {
                        Text(experiment.title)
                            .font(.title2.bold())
                    }
                    Spacer()
                    Button(isEditing ? "保存" : "编辑") {
                        if isEditing { saveChanges() } else { startEditing() }
                    }
                    .buttonStyle(.bordered)
                }

                // Metadata
                HStack(spacing: 16) {
                    if let date = experiment.createdAt {
                        Label(date.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let linkedId = experiment.linkedSubmissionId {
                        Label("投稿: \(linkedId.prefix(8))", systemImage: "link")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                }

                // Config
                VStack(alignment: .leading, spacing: 8) {
                    Text("实验配置").font(.headline)
                    if isEditing {
                        TextEditor(text: $editConfigText)
                            .font(.system(.caption, design: .monospaced))
                            .frame(minHeight: 120)
                            .padding(4)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                        if let configError {
                            HStack(spacing: 4) {
                                Image(systemName: "exclamationmark.triangle")
                                    .foregroundStyle(.red)
                                Text(configError)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                    } else if let config = experiment.config {
                        configView(config)
                    } else {
                        Text("暂无配置").font(.caption).foregroundStyle(.secondary)
                    }
                }

                // Result
                VStack(alignment: .leading, spacing: 8) {
                    Text("实验结果").font(.headline)
                    if isEditing {
                        TextEditor(text: $editResultText)
                            .font(.system(.caption, design: .monospaced))
                            .frame(minHeight: 120)
                            .padding(4)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                    } else if let result = experiment.result, !result.isEmpty {
                        Text(result)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                    } else {
                        Text("暂无结果").font(.caption).foregroundStyle(.secondary)
                    }
                }

                // Notes
                VStack(alignment: .leading, spacing: 8) {
                    Text("实验笔记").font(.headline)
                    if isEditing {
                        TextEditor(text: $editNotes)
                            .frame(minHeight: 80)
                            .padding(4)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                    } else if let notes = experiment.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.subheadline)
                    } else {
                        Text("暂无笔记").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("实验详情")
    }

    @ViewBuilder
    private func configView(_ dict: [String: JSONValue]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(dict.sorted(by: { $0.key < $1.key })), id: \.key) { key, value in
                HStack(alignment: .top) {
                    Text(key)
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                        .frame(width: 100, alignment: .leading)
                    Text(value.description)
                        .font(.caption)
                        .textSelection(.enabled)
                    Spacer()
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    private func startEditing() {
        editTitle = experiment.title
        editConfigText = prettyJSON(from: experiment.config)
        editResultText = experiment.result ?? ""
        editNotes = experiment.notes ?? ""
        configError = nil
        isEditing = true
    }

    private func saveChanges() {
        var updated = experiment
        updated.title = editTitle
        updated.notes = editNotes.isEmpty ? nil : editNotes

        let trimmedConfig = editConfigText.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedConfig.isEmpty {
            updated.config = nil
        } else if let data = trimmedConfig.data(using: .utf8) {
            do {
                let parsed = try JSONDecoder().decode([String: JSONValue].self, from: data)
                updated.config = parsed.isEmpty ? nil : parsed
                configError = nil
            } catch {
                configError = "JSON 格式错误，请检查配置内容"
                return
            }
        }

        let trimmedResult = editResultText.trimmingCharacters(in: .whitespacesAndNewlines)
        updated.result = trimmedResult.isEmpty ? nil : editResultText
        try? ExperimentRepository().update(updated)
        isEditing = false
        onUpdate()
    }
}

private func prettyJSON(from dict: [String: JSONValue]?) -> String {
    guard let dict, !dict.isEmpty else { return "{}" }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    guard let data = try? encoder.encode(dict),
          let text = String(data: data, encoding: .utf8) else {
        return "{}"
    }
    return text
}

// MARK: - Create Sheet

private struct CreateExperimentSheet: View {
    let onCreated: (ExperimentRecord) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var configText = ""
    @State private var notes = ""
    @State private var configError: String?

    var body: some View {
        VStack(spacing: 16) {
            Text("新建实验")
                .font(.headline)

            Form {
                TextField("实验标题", text: $title)
                TextField("配置 (JSON)", text: $configText, axis: .vertical)
                    .font(.system(.caption, design: .monospaced))
                    .lineLimit(3...6)
                if let configError {
                    Text(configError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                TextField("笔记", text: $notes, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let trimmed = configText.trimmingCharacters(in: .whitespacesAndNewlines)
                    var parsed: [String: JSONValue]? = nil
                    if !trimmed.isEmpty {
                        guard let data = trimmed.data(using: .utf8),
                              let dict = try? JSONDecoder().decode([String: JSONValue].self, from: data) else {
                            configError = "JSON 格式错误，请检查配置内容"
                            return
                        }
                        parsed = dict.isEmpty ? nil : dict
                    }
                    let exp = ExperimentRecord(
                        id: UUID().uuidString,
                        title: title,
                        config: parsed,
                        result: nil,
                        notes: notes.isEmpty ? nil : notes,
                        linkedSubmissionId: nil,
                        createdAt: Date(),
                        updatedAt: nil
                    )
                    try? ExperimentRepository().insert(exp)
                    onCreated(exp)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 420, height: 380)
    }
}
