import SwiftUI
import UniformTypeIdentifiers

struct PapersView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var router: AppRouter
    @StateObject private var paperService = PaperService()
    @StateObject private var knowledgeService = KnowledgeService()
    @State private var papers: [Paper] = []
    @State private var interests: [ResearchInterest] = []
    @State private var selectedPaper: Paper?
    @State private var showingImporter = false
    @State private var searchText = ""
    @State private var sortMode: SortMode = .createdAt
    @State private var selectedTag: String = ""
    @State private var selectedInterestId: String = ""
    @State private var confirmDeleteInterestId: String?

    enum SortMode: String, CaseIterable {
        case createdAt = "导入时间"
        case title = "名称"
        case importance = "重要性"
    }

    var allTags: [String] {
        var tags = Set<String>()
        for paper in papers {
            paper.tags.forEach { tags.insert($0) }
        }
        return Array(tags).sorted()
    }

    var sortedPapers: [Paper] {
        var list = papers
        if !searchText.isEmpty {
            list = list.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.authors.joined().localizedCaseInsensitiveContains(searchText)
            }
        }
        if !selectedTag.isEmpty {
            list = list.filter { $0.tags.contains(selectedTag) }
        }
        if !selectedInterestId.isEmpty {
            list = list.filter { $0.researchInterestId == selectedInterestId }
        }
        switch sortMode {
        case .createdAt:
            list.sort { ($0.createdAt) > ($1.createdAt) }
        case .title:
            list.sort { $0.title.localizedCompare($1.title) == .orderedAscending }
        case .importance:
            let order = ["red", "orange", "yellow", "green", "blue", "purple"]
            list.sort {
                let idx0 = order.firstIndex(of: $0.importanceColor ?? "") ?? Int.max
                let idx1 = order.firstIndex(of: $1.importanceColor ?? "") ?? Int.max
                return idx0 < idx1
            }
        }
        return list
    }

    var groupedPapers: [(ResearchInterest?, [Paper])] {
        let list = sortedPapers
        if !selectedInterestId.isEmpty {
            let interest = interests.first { $0.id == selectedInterestId }
            return [(interest, list)]
        }
        var result: [(ResearchInterest?, [Paper])] = []
        let grouped = Dictionary(grouping: list) { $0.researchInterestId ?? "" }
        for interest in interests {
            if let group = grouped[interest.id], !group.isEmpty {
                result.append((interest, group))
            }
        }
        if let ungrouped = grouped[""], !ungrouped.isEmpty {
            result.append((nil, ungrouped))
        }
        return result
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                filterBar
                paperList
            }
            .navigationTitle("论文")
            .toolbar {
                ToolbarItem {
                    Button(action: { showingImporter = true }) {
                        Label("上传", systemImage: "plus")
                    }
                }
            }
        } detail: {
            if let paper = selectedPaper {
                PaperDetailView(paper: paper, paperService: paperService, settings: settings, router: router, onUpdate: reloadPapers)
            } else {
                ContentUnavailableView("选择一篇论文", systemImage: "doc.text")
            }
        }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.pdf],
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                Task {
                    for url in urls {
                        _ = await paperService.upload(fileURL: url, settings: settings)
                    }
                    reloadPapers()
                }
            }
        }
        .onAppear {
            reloadPapers()
            loadInterests()
        }
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("搜索论文...", text: $searchText)
                    .textFieldStyle(.plain)
            }
            .padding(8)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)

            HStack(spacing: 8) {
                Picker("排序", selection: $sortMode) {
                    ForEach(SortMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)
                .frame(width: 100)

                Picker("研究方向", selection: $selectedInterestId) {
                    Text("全部").tag("")
                    ForEach(interests) { interest in
                        Text(interest.topic).tag(interest.id)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)

                if !allTags.isEmpty {
                    Picker("标签", selection: $selectedTag) {
                        Text("全部标签").tag("")
                        ForEach(allTags, id: \.self) { tag in
                            Text(tag).tag(tag)
                        }
                    }
                    .pickerStyle(.menu)
                    .controlSize(.small)
                }
            }
        }
        .padding()
    }

    // MARK: - Paper List

    private var paperList: some View {
        List(selection: $selectedPaper) {
            if searchText.isEmpty && selectedTag.isEmpty && selectedInterestId.isEmpty {
                ForEach(groupedPapers, id: \.0?.id) { interest, group in
                    let isConfirming = confirmDeleteInterestId == interest?.id
                    Section {
                        if isConfirming {
                            HStack(spacing: 8) {
                                Button("保留论文") {
                                    if let id = interest?.id {
                                        knowledgeService.deleteInterestOnly(id: id)
                                        confirmDeleteInterestId = nil
                                        reloadPapers()
                                        loadInterests()
                                    }
                                }
                                .buttonStyle(.borderless)
                                .controlSize(.mini)
                                .font(.caption2)
                                Button("删除全部", role: .destructive) {
                                    if let id = interest?.id {
                                        knowledgeService.deleteInterestBundle(id: id)
                                        confirmDeleteInterestId = nil
                                        reloadPapers()
                                        loadInterests()
                                    }
                                }
                                .buttonStyle(.borderless)
                                .controlSize(.mini)
                                .font(.caption2)
                                Button { confirmDeleteInterestId = nil } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.borderless)
                            }
                        }
                        ForEach(group) { paper in
                            PaperRow(paper: paper)
                                .tag(paper)
                        }
                    } header: {
                        HStack {
                            Text(interest?.topic ?? "未归类")
                                .font(.caption.weight(.semibold))
                            Spacer()
                            if interest != nil && !isConfirming {
                                Button {
                                    confirmDeleteInterestId = interest?.id
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                                .buttonStyle(.borderless)
                            }
                        }
                    }
                }
            } else {
                ForEach(sortedPapers) { paper in
                    PaperRow(paper: paper)
                        .tag(paper)
                }
            }
        }
        .listStyle(.sidebar)
    }

    // MARK: - Actions

    private func reloadPapers() {
        papers = paperService.list()
        if let selected = selectedPaper {
            selectedPaper = papers.first { $0.id == selected.id }
        }
    }

    private func loadInterests() {
        interests = knowledgeService.listInterests()
    }
}

// MARK: - Paper Row

struct PaperRow: View {
    let paper: Paper

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(paper.title)
                    .font(.subheadline.bold())
                    .lineLimit(2)
                if let color = paper.importanceColor, !color.isEmpty {
                    Circle()
                        .fill(colorFromString(color))
                        .frame(width: 8, height: 8)
                }
            }
            if !paper.authors.isEmpty {
                Text(paper.authors.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            HStack {
                if let year = paper.year {
                    Text("\(year)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                BadgeView(text: paper.status.rawValue, color: statusColor)
                if !paper.tags.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(paper.tags.prefix(3), id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 1)
                                .background(Color.accentColor.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var statusColor: Color {
        switch paper.status {
        case .uploaded: return .orange
        case .parsing: return .blue
        case .parsed: return .green
        case .failed: return .red
        case .analyzed: return .purple
        }
    }

    private func colorFromString(_ color: String) -> Color {
        switch color {
        case "red": return .red
        case "orange": return .orange
        case "yellow": return .yellow
        case "green": return .green
        case "blue": return .blue
        case "purple": return .purple
        default: return .clear
        }
    }
}
