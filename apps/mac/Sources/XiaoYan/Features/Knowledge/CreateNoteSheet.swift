import SwiftUI

struct CreateNoteSheet: View {
    let knowledgeService: KnowledgeService
    let settings: AppSettings
    let interests: [ResearchInterest]
    let preselectedInterestId: String?
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var content = ""
    @State private var tagsText = ""
    @State private var selectedInterestId: String
    @State private var editorTab: NoteEditorTab = .edit

    init(
        knowledgeService: KnowledgeService,
        settings: AppSettings,
        interests: [ResearchInterest],
        preselectedInterestId: String? = nil,
        onCreated: @escaping () -> Void
    ) {
        self.knowledgeService = knowledgeService
        self.settings = settings
        self.interests = interests
        self.preselectedInterestId = preselectedInterestId
        self.onCreated = onCreated
        _selectedInterestId = State(initialValue: preselectedInterestId ?? "")
    }

    var body: some View {
        VStack(spacing: 16) {
            Text("新建笔记")
                .font(.headline)

            Form {
                TextField("标题", text: $title)
                noteContentField
                TextField("标签（逗号分隔）", text: $tagsText)
                if !interests.isEmpty {
                    Picker("关联研究方向", selection: $selectedInterestId) {
                        Text("无").tag("")
                        ForEach(interests) { interest in
                            Text(interest.topic).tag(interest.id)
                        }
                    }
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let tags = tagsText.components(separatedBy: ",")
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty }
                    var note = knowledgeService.createNote(
                        title: title,
                        content: content,
                        researchInterestId: selectedInterestId.isEmpty ? nil : selectedInterestId,
                        settings: settings
                    )
                    note.tags = tags.isEmpty ? nil : tags
                    try? KnowledgeRepository().updateNote(note)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 460, height: 440)
    }

    private var noteContentField: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("支持 Markdown")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Picker("", selection: $editorTab) {
                    ForEach(NoteEditorTab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 120)
            }
            if editorTab == .edit {
                TextEditor(text: $content)
                    .font(.body)
                    .frame(minHeight: 120)
            } else {
                MarkdownText(content: content)
                    .frame(minHeight: 120, alignment: .topLeading)
            }
        }
    }
}

private enum NoteEditorTab: String, CaseIterable {
    case edit = "编辑"
    case preview = "预览"
}
