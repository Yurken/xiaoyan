import SwiftUI

struct NoteDetailView: View {
    let note: KnowledgeNote
    let interests: [ResearchInterest]
    let knowledgeService: KnowledgeService
    let onUpdate: () -> Void

    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editContent = ""
    @State private var editTagsText = ""
    @State private var editInterestId = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    if isEditing {
                        TextField("标题", text: $editTitle)
                            .font(.title2.bold())
                            .textFieldStyle(.plain)
                    } else {
                        Text(note.title)
                            .font(.title2.bold())
                    }
                    Spacer()
                    Button(isEditing ? "保存" : "编辑") {
                        if isEditing { save() } else { startEdit() }
                    }
                    .buttonStyle(.bordered)
                }

                // Metadata
                HStack(spacing: 16) {
                    if let sourceType = note.sourceType {
                        Label(sourceType, systemImage: "doc.text")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let date = note.createdAt {
                        Label(date.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if note.embedding != nil {
                        Label("已嵌入", systemImage: "cpu")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                    if !isEditing, let interestId = note.researchInterestId,
                       let interest = interests.first(where: { $0.id == interestId }) {
                        Label(interest.topic, systemImage: "map")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                }

                // Tags
                if let tags = note.tags, !tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.accentColor.opacity(0.1))
                                .cornerRadius(6)
                        }
                    }
                }
                if isEditing {
                    TextField("标签（逗号分隔）", text: $editTagsText)
                        .font(.caption)
                    if !interests.isEmpty {
                        Picker("关联研究方向", selection: $editInterestId) {
                            Text("无").tag("")
                            ForEach(interests) { interest in
                                Text(interest.topic).tag(interest.id)
                            }
                        }
                        .pickerStyle(.menu)
                    }
                }

                Divider()

                // Content
                if isEditing {
                    TextEditor(text: $editContent)
                        .font(.body)
                        .frame(minHeight: 300)
                        .padding(4)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                } else {
                    Text(note.content)
                        .font(.body)
                        .textSelection(.enabled)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("笔记详情")
    }

    private func startEdit() {
        editTitle = note.title
        editContent = note.content
        editTagsText = note.tags?.joined(separator: ", ") ?? ""
        editInterestId = note.researchInterestId ?? ""
        isEditing = true
    }

    private func save() {
        let tags = editTagsText.components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        var updated = note
        updated.title = editTitle
        updated.content = editContent
        updated.tags = tags.isEmpty ? nil : tags
        updated.researchInterestId = editInterestId.isEmpty ? nil : editInterestId
        try? KnowledgeRepository().updateNote(updated)
        isEditing = false
        onUpdate()
    }
}
