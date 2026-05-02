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
    @State private var confirmDeleteInterestId: String?
    @State private var noteClaimCounts: [String: Int] = [:]

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

    /// 未绑定 interest 或绑定到不存在 interest 的笔记。
    var ungroupedNotes: [KnowledgeNote] {
        let interestIds = Set(interests.map(\.id))
        return notes.filter { note in
            guard let id = note.researchInterestId else { return true }
            return !interestIds.contains(id)
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
                NoteDetailView(note: note, interests: interests, knowledgeService: knowledgeService, onUpdate: reload)
            } else {
                ContentUnavailableView("选择项目", systemImage: "book")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreateNote) {
            CreateNoteSheet(knowledgeService: knowledgeService, settings: settings, interests: interests, onCreated: reload)
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
            } else if !searchText.isEmpty {
                // 搜索模式：平铺
                List(filteredNotes, selection: $selectedNote) { note in
                    NoteRow(note: note, linkedClaimCount: noteClaimCounts[note.id])
                        .tag(note)
                        .contextMenu {
                            Button("删除", role: .destructive) {
                                knowledgeService.deleteNote(id: note.id)
                                reload()
                            }
                        }
                }
                .listStyle(.sidebar)
            } else {
                groupedNotesList
            }
        }
    }

    /// 按 interest 分组的笔记列表（与 desktop NotesPanel CollapsibleGroup 对齐）。
    private var groupedNotesList: some View {
        List(selection: $selectedNote) {
            ForEach(interests) { interest in
                NotesInterestSection(
                    interest: interest,
                    notes: notes.filter { $0.researchInterestId == interest.id },
                    noteClaimCounts: noteClaimCounts,
                    confirmDeleteId: $confirmDeleteInterestId,
                    onDeleteOnly: {
                        knowledgeService.deleteInterestOnly(id: interest.id)
                        confirmDeleteInterestId = nil
                        reload()
                    },
                    onDeleteAll: {
                        knowledgeService.deleteInterestBundle(id: interest.id)
                        confirmDeleteInterestId = nil
                        reload()
                    },
                    onDeleteNote: { id in
                        knowledgeService.deleteNote(id: id)
                        reload()
                    }
                )
            }
            if !ungroupedNotes.isEmpty {
                Section {
                    ForEach(ungroupedNotes) { note in
                        NoteRow(note: note, linkedClaimCount: noteClaimCounts[note.id])
                            .tag(note)
                            .contextMenu {
                                Button("删除", role: .destructive) {
                                    knowledgeService.deleteNote(id: note.id)
                                    reload()
                                }
                            }
                    }
                } header: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("未归档笔记")
                            .font(.caption.weight(.semibold))
                        Text("这些笔记暂未绑定主题")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .listStyle(.sidebar)
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
        noteClaimCounts = buildNoteClaimCounts()
        if let selected = selectedNote {
            selectedNote = notes.first { $0.id == selected.id }
        }
    }

    private func buildNoteClaimCounts() -> [String: Int] {
        guard let links = try? KnowledgeRepository().listAllEvidenceLinks() else { return [:] }
        var counts: [String: Int] = [:]
        for link in links where link.sourceKind == "note" {
            counts[link.sourceId, default: 0] += 1
        }
        return counts
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

// MARK: - Edit Folder Name Sheet

private struct EditFolderNameSheet: View {
    let currentName: String
    let onSave: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""

    var body: some View {
        VStack(spacing: 16) {
            Text("编辑文件夹名")
                .font(.headline)

            Form {
                TextField("文件夹名称", text: $name)
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("保存") {
                    let trimmed = name.trimmingCharacters(in: .whitespaces)
                    if !trimmed.isEmpty {
                        onSave(trimmed)
                    }
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 400, height: 180)
        .onAppear { name = currentName }
    }
}

// MARK: - Note Row

// MARK: - Notes Interest Section（按研究方向分组的笔记折叠面板）

private struct NotesInterestSection: View {
    let interest: ResearchInterest
    let notes: [KnowledgeNote]
    var noteClaimCounts: [String: Int]
    @Binding var confirmDeleteId: String?
    let onDeleteOnly: () -> Void
    let onDeleteAll: () -> Void
    let onDeleteNote: (String) -> Void
    @State private var isExpanded: Bool = true

    private var folderTitle: String {
        let trimmed = interest.folderName?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmed.isEmpty ? interest.topic : trimmed
    }

    private var isConfirming: Bool { confirmDeleteId == interest.id }

    private var linkedVisibleNoteCount: Int {
        notes.filter { (noteClaimCounts[$0.id] ?? 0) > 0 }.count
    }

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            if notes.isEmpty {
                Text("该主题下暂无笔记")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .padding(.vertical, 4)
            } else {
                ForEach(notes) { note in
                    NoteRow(note: note, linkedClaimCount: noteClaimCounts[note.id])
                        .tag(note)
                        .contextMenu {
                            Button("删除", role: .destructive) {
                                onDeleteNote(note.id)
                            }
                        }
                }
            }
        } label: {
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(folderTitle)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                    if folderTitle != interest.topic {
                        Text("研究主题：\(interest.topic)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text("图谱关联 \(linkedVisibleNoteCount)/\(notes.count)")
                    .font(.caption2)
                    .foregroundStyle(linkedVisibleNoteCount > 0 ? .blue : .secondary)
                if isConfirming {
                    Button("置为未归档") { onDeleteOnly() }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                        .font(.caption2)
                    Button("删除全部", role: .destructive) { onDeleteAll() }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                        .font(.caption2)
                    Button {
                        confirmDeleteId = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.borderless)
                } else {
                    Button {
                        confirmDeleteId = interest.id
                    } label: {
                        Image(systemName: "trash")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.borderless)
                    .help("删除文件夹")
                }
            }
            .padding(.vertical, 1)
        }
    }
}

// MARK: - Interest List Row

private struct InterestListRow: View {
    let interest: ResearchInterest
    let knowledgeService: KnowledgeService
    let settings: AppSettings
    let onUpdate: () -> Void
    @EnvironmentObject var router: AppRouter
    @State private var isGenerating = false
    @State private var showingEditFolderName = false

    private var folderTitle: String {
        let trimmed = interest.folderName?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmed.isEmpty ? interest.topic : trimmed
    }

    private var profileHighlights: [(label: String, value: String)] {
        var result: [(label: String, value: String)] = []
        if let goal = interest.profile?.goal, !goal.isEmpty {
            result.append((label: "目标", value: goal))
        }
        if let time = interest.profile?.timeBudget, !time.isEmpty {
            result.append((label: "时间", value: time))
        }
        if let output = interest.profile?.preferredOutput, !output.isEmpty {
            result.append((label: "输出", value: output))
        }
        return result
    }

    private var profileSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text("研究画像")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                    .tracking(0.16 * 9)
                Circle()
                    .fill(Color.blue.opacity(0.7))
                    .frame(width: 5, height: 5)
                Spacer()
            }
            if !profileHighlights.isEmpty {
                HStack(spacing: 6) {
                    ForEach(profileHighlights, id: \.label) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.label)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                                .tracking(0.16 * 8)
                            Text(item.value)
                                .font(.caption)
                                .foregroundStyle(.primary)
                                .lineLimit(2)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 6)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            if let constraints = interest.profile?.constraints, !constraints.isEmpty {
                let items = constraints.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                if !items.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(items, id: \.self) { c in
                            Text(c)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.accentColor.opacity(0.1))
                                .foregroundStyle(Color.accentColor)
                                .cornerRadius(12)
                        }
                    }
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(folderTitle)
                    .font(.subheadline.bold())
                    .lineLimit(1)
                if folderTitle != interest.topic {
                    Text("研究主题：\(interest.topic)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
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

            if !profileHighlights.isEmpty || !(interest.profile?.constraints?.isEmpty ?? true) {
                profileSection
            }

            HStack {
                Spacer()
                Button("工作台") {
                    router.openWorkbench(interestId: interest.id)
                }
                .buttonStyle(.borderless)
                .controlSize(.small)
                .font(.caption2)
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
            Button("打开工作台") {
                router.openWorkbench(interestId: interest.id)
            }
            Button("编辑文件夹名") {
                showingEditFolderName = true
            }
            Button("删除", role: .destructive) {
                knowledgeService.deleteInterest(id: interest.id)
                onUpdate()
            }
        }
        .sheet(isPresented: $showingEditFolderName) {
            EditFolderNameSheet(
                currentName: folderTitle,
                onSave: { name in
                    knowledgeService.updateInterestFolderName(id: interest.id, folderName: name)
                    onUpdate()
                }
            )
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

// MARK: - Create Interest Sheet

private struct CreateInterestSheet: View {
    let knowledgeService: KnowledgeService
    let onCreated: () -> Void
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var settings: AppSettings
    @State private var topic = ""
    @State private var keywordsText = ""
    @State private var goal = ""
    @State private var background = ""
    @State private var timeBudget = ""
    @State private var constraints = ""
    @State private var knownContext = ""
    @State private var preferredOutput = ""
    @State private var showingWizard = false

    // MARK: - AI Hints
    @State private var hintStatus: HintStatus = .idle
    @State private var aiSuggestions: PlannerSuggestionState? = nil
    @State private var hintMessage = ""
    @State private var currentRequestId = 0
    @State private var hintCache: [String: PlannerSuggestionState] = [:]
    @State private var aiDisabled = false

    enum HintStatus: String {
        case idle, loading, ready, fallback

        var label: String {
            switch self {
            case .loading: return "小妍处理中"
            case .ready: return "小妍实时建议"
            case .fallback: return "本地兜底"
            case .idle: return "待输入"
            }
        }
    }

    private var completionRatio: Double {
        let fields = [topic, keywordsText, goal, background, timeBudget, constraints, knownContext, preferredOutput]
        let filled = fields.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count
        return Double(filled) / Double(fields.count)
    }

    private var draft: PlannerDraft {
        PlannerDraft(
            topic: topic,
            keywords: parseTags(keywordsText),
            goal: goal,
            background: background,
            timeBudget: timeBudget,
            constraints: parseTags(constraints),
            knownContext: knownContext,
            preferredOutput: preferredOutput
        )
    }

    private var fallbackSuggestions: PlannerSuggestionState {
        buildPlannerSuggestions(draft)
    }

    private var suggestions: PlannerSuggestionState {
        mergePlannerSuggestions(fallback: fallbackSuggestions, ai: aiSuggestions)
    }

    var body: some View {
        HSplitView {
            formArea
                .frame(minWidth: 380, idealWidth: 420)

            if !showingWizard {
                hintPanel
                    .frame(minWidth: 260, idealWidth: 300)
            }
        }
        .padding()
        .frame(minWidth: showingWizard ? 480 : 740, minHeight: 560)
        .onChange(of: draft) {
            scheduleHintRequest()
        }
    }

    // MARK: - Form Area

    private var formArea: some View {
        VStack(spacing: 12) {
            Text("创建研究方向")
                .font(.headline)

            if showingWizard {
                TopicDiscoveryWizardView(
                    knowledgeService: knowledgeService,
                    onSelect: { selectedTopic in
                        topic = selectedTopic
                        showingWizard = false
                    },
                    onClose: { showingWizard = false }
                )
            } else {
                HStack {
                    Spacer()
                    Button {
                        showingWizard = true
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                            Text("让小妍帮你找方向")
                        }
                        .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                Form {
                    TextField("研究主题", text: $topic)
                    TextField("关键词（逗号分隔）", text: $keywordsText)
                    TextField("研究目标", text: $goal, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("研究背景", text: $background, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("时间预算", text: $timeBudget, axis: .vertical)
                        .lineLimit(1...2)
                    TextField("约束条件", text: $constraints, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("已知论文/方法", text: $knownContext, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("期望输出", text: $preferredOutput, axis: .vertical)
                        .lineLimit(2...4)
                }
                .formStyle(.grouped)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("完成度")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(Int(completionRatio * 100))%")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 4)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.accentColor)
                                .frame(width: geo.size.width * completionRatio, height: 4)
                        }
                    }
                    .frame(height: 4)
                }

                HStack {
                    Button("取消") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                    Spacer()
                    Button("创建") {
                        let keywords = parseTags(keywordsText)
                        let profile = InterestProfile(
                            goal: goal.isEmpty ? nil : goal,
                            background: background.isEmpty ? nil : background,
                            timeBudget: timeBudget.isEmpty ? nil : timeBudget,
                            constraints: constraints.isEmpty ? nil : constraints,
                            knownContext: knownContext.isEmpty ? nil : knownContext,
                            preferredOutput: preferredOutput.isEmpty ? nil : preferredOutput
                        )
                        _ = knowledgeService.createInterest(topic: topic, keywords: keywords.isEmpty ? nil : keywords, profile: profile)
                        onCreated()
                        dismiss()
                    }
                    .keyboardShortcut(.defaultAction)
                    .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Hint Panel

    private var hintPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("智能提示")
                    .font(.subheadline.bold())
                Spacer()
                Text(hintStatus.label)
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(hintStatus == .fallback ? Color.gray.opacity(0.15) : Color.blue.opacity(0.12))
                    .foregroundColor(hintStatus == .fallback ? .secondary : .blue)
                    .cornerRadius(4)
            }

            hintCard(title: "系统理解") {
                HStack(alignment: .top, spacing: 6) {
                    if hintStatus == .loading {
                        ProgressView()
                            .controlSize(.small)
                            .frame(width: 14, height: 14)
                    }
                    Text(suggestions.summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            hintCard(title: "建议下一步") {
                VStack(alignment: .leading, spacing: 4) {
                    Text(suggestions.nextFieldLabel)
                        .font(.caption.bold())
                    Text("当前信息已足以触发这一项的更精准建议；继续补充后，整体规划会明显更聚焦。")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if hintStatus == .fallback, !hintMessage.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("AI 建议暂不可用")
                        .font(.caption2.bold())
                        .foregroundColor(.orange)
                    Text("当前显示本地兜底建议。原因：\(hintMessage)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(8)
                .background(Color.orange.opacity(0.08))
                .cornerRadius(8)
            }

            hintCard(title: "已识别方向") {
                if suggestions.matchedDomains.isEmpty {
                    Text("请先填写研究主题")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                } else {
                    FlowLayout(spacing: 6) {
                        ForEach(suggestions.matchedDomains, id: \.self) { domain in
                            Text(domain)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.blue.opacity(0.12))
                                .foregroundColor(.blue)
                                .cornerRadius(4)
                        }
                    }
                }
            }

            hintCard(title: "为什么要补这些") {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(hintWhyItems, id: \.self) { item in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            Text(item)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }

            Spacer()
        }
        .padding(12)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
    }

    private func hintCard(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title.uppercased())
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .tracking(1)
            content()
        }
        .padding(8)
        .background(Color.secondary.opacity(0.05))
        .cornerRadius(8)
    }

    private var hintWhyItems: [String] {
        [
            "主题 + 关键词用于识别具体方向与检索语义。",
            "目标 + 基础决定学习路线深度，不然规划容易空泛。",
            "时间预算 + 约束决定推荐资源和任务粒度。",
            "已知论文/方法 + 期望输出决定最后生成物更像综述还是实验路线。",
            "参考文献会在建好主题后自动归档进去，后续规划会优先参考当前主题下的论文。",
        ]
    }

    // MARK: - Debounce Logic

    private func scheduleHintRequest() {
        let payload = draft
        if payload.topic.trimmingCharacters(in: .whitespaces).isEmpty {
            hintStatus = .idle
            aiSuggestions = nil
            hintMessage = ""
            return
        }
        if aiDisabled {
            hintStatus = .fallback
            return
        }

        let signature = payloadSignature(payload)
        if let cached = hintCache[signature] {
            aiSuggestions = cached
            hintStatus = .ready
            hintMessage = ""
            return
        }

        hintStatus = .loading
        hintMessage = ""
        currentRequestId += 1
        let requestId = currentRequestId

        Task {
            try? await Task.sleep(nanoseconds: 700_000_000)
            guard requestId == currentRequestId else { return }

            let response = await knowledgeService.generateInterestHints(
                topic: payload.topic,
                keywords: payload.keywords,
                goal: payload.goal.isEmpty ? nil : payload.goal,
                background: payload.background.isEmpty ? nil : payload.background,
                timeBudget: payload.timeBudget.isEmpty ? nil : payload.timeBudget,
                constraints: payload.constraints.isEmpty ? nil : payload.constraints,
                knownContext: payload.knownContext.isEmpty ? nil : payload.knownContext,
                preferredOutput: payload.preferredOutput.isEmpty ? nil : payload.preferredOutput,
                settings: settings
            )

            guard requestId == currentRequestId else { return }

            if let response = response {
                let state = PlannerSuggestionState(
                    matchedDomains: response.matchedDomains,
                    nextField: DraftField(rawValue: response.nextField) ?? .topic,
                    nextFieldLabel: FIELD_LABELS[DraftField(rawValue: response.nextField) ?? .topic] ?? "",
                    summary: response.summary,
                    keywordSuggestions: response.keywordSuggestions,
                    goalSuggestions: response.goalSuggestions,
                    backgroundPrompts: response.backgroundPrompts,
                    timeBudgetSuggestions: response.timeBudgetSuggestions,
                    constraintSuggestions: response.constraintSuggestions,
                    knownContextSuggestions: response.knownContextSuggestions,
                    outputSuggestions: response.outputSuggestions
                )
                hintCache[signature] = state
                aiSuggestions = state
                hintStatus = .ready
                hintMessage = ""
            } else {
                aiDisabled = true
                aiSuggestions = nil
                hintStatus = .fallback
                hintMessage = "模型配置不可用"
            }
        }
    }

    private func payloadSignature(_ payload: PlannerDraft) -> String {
        "\(payload.topic)|\(payload.keywords.joined(separator: ","))|\(payload.goal)|\(payload.background)|\(payload.timeBudget)|\(payload.constraints.joined(separator: ","))|\(payload.knownContext)|\(payload.preferredOutput)"
    }

    private func parseTags(_ text: String) -> [String] {
        text.components(separatedBy: CharacterSet(charactersIn: ",，;；\n"))
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }
}
