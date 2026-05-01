import SwiftUI
import GRDB

struct KnowledgeView: View {
    @StateObject private var knowledgeService = KnowledgeService()
    @EnvironmentObject var settings: AppSettings
    @State private var selectedTab: Tab = .notes
    @State private var notes: [KnowledgeNote] = []
    @State private var interests: [ResearchInterest] = []
    @State private var selectedNote: KnowledgeNote?
    @State private var searchText = ""
    @State private var showingCreateNote = false
    @State private var showingCreateInterest = false
    @State private var showingWebClip = false
    @State private var isSemanticSearch = false
    @State private var semanticResults: [SemanticSearchResult] = []
    @State private var isSearching = false

    enum Tab: String, CaseIterable {
        case notes = "笔记"
        case interests = "研究方向"
        case claims = "论断"
        case graph = "图谱"
    }

    var filteredNotes: [KnowledgeNote] {
        if searchText.isEmpty { return notes }
        let q = searchText.lowercased()
        return notes.filter {
            $0.title.lowercased().contains(q) ||
            $0.content.lowercased().contains(q) ||
            ($0.tags?.contains(where: { $0.lowercased().contains(q) }) ?? false)
        }
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                // Search bar
                HStack(spacing: 8) {
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundStyle(.secondary)
                        TextField("搜索知识库...", text: $searchText)
                            .textFieldStyle(.plain)
                            .onSubmit { performSearch() }
                    }
                    .padding(8)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)

                    Button(action: { isSemanticSearch.toggle() }) {
                        Image(systemName: isSemanticSearch ? "brain.head.profile" : "text.magnifyingglass")
                            .foregroundStyle(isSemanticSearch ? .blue : .secondary)
                    }
                    .buttonStyle(.borderless)
                    .help(isSemanticSearch ? "语义搜索已开启" : "文本搜索")
                }
                .padding()

                // Tabs
                Picker("类型", selection: $selectedTab) {
                    ForEach(Tab.allCases, id: \.self) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.bottom, 8)

                switch selectedTab {
                case .notes: notesList
                case .interests: interestsList
                case .claims: ClaimsView()
                case .graph: KnowledgeGraphCanvasView()
                }
            }
            .navigationTitle("知识")
            .toolbar {
                ToolbarItemGroup {
                    if selectedTab == .notes {
                        Button(action: { showingWebClip = true }) {
                            Label("网页剪藏", systemImage: "link")
                        }
                    }
                    Button(action: {
                        switch selectedTab {
                        case .notes: showingCreateNote = true
                        case .interests: showingCreateInterest = true
                        case .claims, .graph: break
                        }
                    }) {
                        Label("新建", systemImage: "plus")
                    }
                    .disabled(selectedTab == .claims || selectedTab == .graph)
                }
            }
        } detail: {
            if let note = selectedNote, selectedTab == .notes {
                NoteDetailView(note: note, knowledgeService: knowledgeService, onUpdate: reload)
            } else {
                ContentUnavailableView("选择项目", systemImage: "book")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreateNote) {
            CreateNoteSheet(knowledgeService: knowledgeService, settings: settings, onCreated: reload)
        }
        .sheet(isPresented: $showingCreateInterest) {
            CreateInterestSheet(knowledgeService: knowledgeService, onCreated: reload)
        }
        .sheet(isPresented: $showingWebClip) {
            WebClipSheet(knowledgeService: knowledgeService, onCreated: reload)
        }
    }

    // MARK: - Notes List

    private var notesList: some View {
        Group {
            if isSearching {
                ProgressView("搜索中...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isSemanticSearch && !semanticResults.isEmpty {
                List {
                    ForEach(semanticResults, id: \.id) { result in
                        Button(action: {
                            if let note = notes.first(where: { $0.id == result.id }) {
                                selectedNote = note
                            }
                        }) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(result.source)
                                    .font(.subheadline.bold())
                                    .lineLimit(1)
                                    .foregroundStyle(.primary)
                                Text(result.content)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(3)
                                Text("相似度: \(String(format: "%.2f", result.score))")
                                    .font(.caption2)
                                    .foregroundStyle(.blue)
                            }
                            .padding(.vertical, 2)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.sidebar)
            } else if filteredNotes.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "note.text")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text(searchText.isEmpty ? "还没有笔记" : "没有找到相关笔记")
                        .font(.subheadline.bold())
                    if searchText.isEmpty {
                        Text("创建笔记来记录研究心得")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredNotes, selection: $selectedNote) { note in
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

    // MARK: - Interests List

    private var interestsList: some View {
        Group {
            if interests.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "map")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("还没有研究方向")
                        .font(.subheadline.bold())
                    Text("创建研究方向，小妍将为你规划学习路径")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(interests) { interest in
                        InterestListRow(interest: interest, knowledgeService: knowledgeService, settings: settings, onUpdate: reload)
                    }
                }
                .listStyle(.plain)
            }
        }
    }

    private func reload() {
        notes = knowledgeService.listNotes()
        interests = knowledgeService.listInterests()
        if let selected = selectedNote {
            selectedNote = notes.first { $0.id == selected.id }
        }
    }

    private func performSearch() {
        guard isSemanticSearch, !searchText.isEmpty else {
            semanticResults = []
            return
        }
        isSearching = true
        Task {
            let results = await knowledgeService.semanticSearchNotes(query: searchText, settings: settings)
            await MainActor.run {
                semanticResults = results
                isSearching = false
            }
        }
    }
}

// MARK: - Web Clip Sheet

private struct WebClipSheet: View {
    let knowledgeService: KnowledgeService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var url = ""
    @State private var statusMessage: String?
    @State private var isLoading = false

    var body: some View {
        VStack(spacing: 16) {
            Text("网页剪藏")
                .font(.headline)

            TextField("输入网页 URL", text: $url)
                .textFieldStyle(.roundedBorder)

            if let msg = statusMessage {
                Text(msg)
                    .font(.caption)
                    .foregroundStyle(msg.contains("成功") ? .green : .red)
            }

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                if isLoading {
                    ProgressView().controlSize(.small)
                } else {
                    Button("剪藏") {
                        clip()
                    }
                    .keyboardShortcut(.defaultAction)
                    .disabled(url.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 400, height: 180)
    }

    private func clip() {
        isLoading = true
        Task {
            let note = await knowledgeService.webClip(url: url.trimmingCharacters(in: .whitespaces))
            await MainActor.run {
                isLoading = false
                if note != nil {
                    statusMessage = "剪藏成功"
                    onCreated()
                    dismiss()
                } else {
                    statusMessage = "剪藏失败，请检查 URL 或网络"
                }
            }
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

// MARK: - Interest List Row

private struct InterestListRow: View {
    let interest: ResearchInterest
    let knowledgeService: KnowledgeService
    let settings: AppSettings
    let onUpdate: () -> Void
    @State private var isGenerating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(interest.topic)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Spacer()
                if interest.learningPath != nil {
                    BadgeView(text: "已有路径", color: .green)
                }
            }

            if let keywords = interest.keywords, !keywords.isEmpty {
                HStack(spacing: 6) {
                    ForEach(keywords.prefix(4), id: \.self) { kw in
                        Text(kw)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }

            if let path = interest.learningPath, let firstStage = path.stages?.first, let desc = firstStage.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack {
                Spacer()
                if isGenerating {
                    ProgressView()
                        .controlSize(.small)
                } else if interest.learningPath == nil {
                    Button("生成学习路径") {
                        generatePath()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
        .padding(.vertical, 4)
        .contextMenu {
            Button("删除", role: .destructive) {
                knowledgeService.deleteInterest(id: interest.id)
                onUpdate()
            }
        }
    }

    private func generatePath() {
        isGenerating = true
        Task {
            _ = await knowledgeService.generateLearningPath(interest: interest, settings: settings)
            await MainActor.run {
                isGenerating = false
                onUpdate()
            }
        }
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
                    var note = knowledgeService.createNote(
                        title: title,
                        content: content,
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
        .frame(width: 460, height: 400)
    }
}

// MARK: - Create Interest Sheet

private struct CreateInterestSheet: View {
    let knowledgeService: KnowledgeService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var topic = ""
    @State private var keywordsText = ""
    @State private var goal = ""
    @State private var background = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("创建研究方向")
                .font(.headline)

            Form {
                TextField("研究主题", text: $topic)
                TextField("关键词（逗号分隔）", text: $keywordsText)
                TextField("研究目标", text: $goal, axis: .vertical)
                    .lineLimit(2...4)
                TextField("研究背景", text: $background, axis: .vertical)
                    .lineLimit(2...4)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("创建") {
                    let keywords = keywordsText.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                    let profile = InterestProfile(goal: goal.isEmpty ? nil : goal, background: background.isEmpty ? nil : background, timeBudget: nil, constraints: nil)
                    _ = knowledgeService.createInterest(topic: topic, keywords: keywords.isEmpty ? nil : keywords, profile: profile)
                    onCreated()
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 420, height: 360)
    }
}
