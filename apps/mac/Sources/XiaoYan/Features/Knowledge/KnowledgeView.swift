import SwiftUI
import GRDB

struct KnowledgeView: View {
    @StateObject private var knowledgeService = KnowledgeService()
    @EnvironmentObject var settings: AppSettings
    @State private var selectedTab: Tab = .notes
    @State private var notes: [KnowledgeNote] = []
    @State private var selectedNote: KnowledgeNote?
    @State private var showingCreateNote = false

    enum Tab: String, CaseIterable {
        case notes = "笔记"
        case claims = "知识断言"
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                Picker("类型", selection: $selectedTab) {
                    ForEach(Tab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                if selectedTab == .notes {
                    notesList
                } else {
                    claimsList
                }
            }
            .navigationTitle("知识")
            .toolbar {
                ToolbarItem {
                    Button(action: { showingCreateNote = true }) {
                        Label("新建笔记", systemImage: "plus")
                    }
                }
            }
        } detail: {
            if let note = selectedNote {
                NoteDetailView(note: note, knowledgeService: knowledgeService, onUpdate: reload)
            } else {
                ContentUnavailableView("选择笔记", systemImage: "note.text")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreateNote) {
            CreateNoteSheet(knowledgeService: knowledgeService, settings: settings, onCreated: reload)
        }
    }

    private var notesList: some View {
        Group {
            if notes.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "note.text")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("还没有笔记")
                        .font(.subheadline.bold())
                    Text("创建笔记来记录研究心得")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(notes, selection: $selectedNote) { note in
                    NoteRow(note: note)
                        .tag(note)
                        .contextMenu {
                            Button("删除", role: .destructive) {
                                knowledgeService.deleteNote(id: note.id)
                                reload()
                            }
                        }
                }
                .listStyle(.sidebar)
            }
        }
    }

    private var claimsList: some View {
        ClaimsListView()
    }

    private func reload() {
        notes = knowledgeService.listNotes()
        if let selected = selectedNote {
            selectedNote = notes.first { $0.id == selected.id }
        }
    }
}

// MARK: - Note Row

private struct NoteRow: View {
    let note: KnowledgeNote

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.title)
                .font(.subheadline.bold())
                .lineLimit(1)
            Text(note.content)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack(spacing: 8) {
                if let tags = note.tags, !tags.isEmpty {
                    ForEach(tags.prefix(3), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
                Spacer()
                if let date = note.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Note Detail

private struct NoteDetailView: View {
    let note: KnowledgeNote
    let knowledgeService: KnowledgeService
    let onUpdate: () -> Void

    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editContent = ""
    @State private var editTagsText = ""

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
                }

                Divider()

                // Content
                if isEditing {
                    TextEditor(text: $editContent)
                        .font(.body)
                        .frame(minHeight: 300)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
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
        try? KnowledgeRepository().updateNote(updated)
        isEditing = false
        onUpdate()
    }
}

// MARK: - Create Note Sheet

private struct CreateNoteSheet: View {
    let knowledgeService: KnowledgeService
    let settings: AppSettings
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var content = ""
    @State private var tagsText = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("新建笔记")
                .font(.headline)

            Form {
                TextField("标题", text: $title)
                TextField("内容", text: $content, axis: .vertical)
                    .lineLimit(8...20)
                TextField("标签（逗号分隔）", text: $tagsText)
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
                    _ = knowledgeService.createNote(
                        title: title,
                        content: content,
                        settings: settings
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
        .frame(width: 460, height: 400)
    }
}

// MARK: - Claims List

private struct ClaimsListView: View {
    @State private var claims: [KnowledgeClaim] = []

    var body: some View {
        Group {
            if claims.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "network")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("还没有知识断言")
                        .font(.subheadline.bold())
                    Text("通过论文分析自动生成知识图谱")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(claims) { claim in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(claim.title)
                            .font(.subheadline.bold())
                        Text(claim.statement)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(3)
                        if let status = claim.status {
                            Text(status)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(statusColor(status).opacity(0.15))
                                .foregroundColor(statusColor(status))
                                .cornerRadius(4)
                        }
                    }
                    .padding(.vertical, 2)
                }
                .listStyle(.sidebar)
            }
        }
        .onAppear { loadClaims() }
    }

    private func loadClaims() {
        // Claims are populated via paper analysis; load from DB
        if let dbClaims = try? DatabaseManager.shared.dbQueue.read({ db in
            try KnowledgeClaim.fetchAll(db, sql: "SELECT * FROM knowledge_graph_claims ORDER BY created_at DESC")
        }) {
            claims = dbClaims
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "supported": return .green
        case "contradicted": return .red
        case "investigating": return .orange
        default: return .secondary
        }
    }
}
