import SwiftUI

struct ToolsView: View {
    @State private var selectedTab: Tab = .arxiv

    enum Tab: String, CaseIterable {
        case arxiv = "arXiv 搜索"
        case sourceLookup = "期刊查询"
        case translation = "学术翻译"
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("工具", selection: $selectedTab) {
                ForEach(Tab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            switch selectedTab {
            case .arxiv: ArxivSearchView()
            case .sourceLookup: SourceLookupView()
            case .translation: TranslationView()
            }
        }
        .navigationTitle("工具")
    }
}

// MARK: - arXiv Search

private struct ArxivSearchView: View {
    @State private var query = ""
    @State private var results: [ArxivClient.Entry] = []
    @State private var isSearching = false
    @State private var searchField: SearchField = .all

    enum SearchField: String, CaseIterable {
        case all = "全部"
        case title = "标题"
        case author = "作者"
        case category = "分类"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack(spacing: 8) {
                Picker("字段", selection: $searchField) {
                    ForEach(SearchField.allCases, id: \.self) { field in
                        Text(field.rawValue).tag(field)
                    }
                }
                .frame(width: 80)

                TextField("搜索 arXiv 论文...", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { search() }

                Button(action: search) {
                    if isSearching {
                        ProgressView().controlSize(.small)
                    } else {
                        Image(systemName: "magnifyingglass")
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

            // Results
            if results.isEmpty && !isSearching {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("搜索 arXiv 论文")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(results) { entry in
                    ArxivEntryRow(entry: entry)
                }
                .listStyle(.plain)
            }
        }
    }

    private func search() {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isSearching = true

        Task {
            do {
                switch searchField {
                case .all:
                    results = try await ArxivClient.search(query: query, maxResults: 30)
                case .title:
                    results = try await ArxivClient.structuredSearch(title: query, maxResults: 30)
                case .author:
                    results = try await ArxivClient.structuredSearch(author: query, maxResults: 30)
                case .category:
                    results = try await ArxivClient.structuredSearch(category: query, maxResults: 30)
                }
            } catch {
                results = []
            }
            isSearching = false
        }
    }
}

private struct ArxivEntryRow: View {
    let entry: ArxivClient.Entry
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.title)
                .font(.subheadline.bold())
                .lineLimit(isExpanded ? nil : 2)

            if !entry.authors.isEmpty {
                Text(entry.authors.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(isExpanded ? nil : 1)
            }

            if isExpanded {
                Text(entry.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 8) {
                    ForEach(entry.categories.prefix(4), id: \.self) { cat in
                        Text(cat)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }

                    Spacer()

                    if let pdf = entry.pdfURL, let url = URL(string: pdf) {
                        Link("PDF", destination: url)
                            .font(.caption)
                    }
                }
            }

            if let published = entry.published {
                Text(published.prefix(10).description)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture { isExpanded.toggle() }
    }
}

// MARK: - Source Lookup

private struct SourceLookupView: View {
    @State private var query = ""
    @State private var journal: JournalPartition?
    @State private var ccf: CCFCatalogEntry?
    @State private var hasSearched = false

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                TextField("期刊名称或 ISSN...", text: $query)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { lookup() }
                Button("查询", action: lookup)
                    .keyboardShortcut(.defaultAction)
                    .disabled(query.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

            if !hasSearched {
                VStack(spacing: 12) {
                    Image(systemName: "book.closed")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("查询期刊分区和 CCF 评级")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let j = journal {
                            journalCard(j)
                        }
                        if let c = ccf {
                            ccfCard(c)
                        }
                        if journal == nil && ccf == nil {
                            Text("未找到匹配结果")
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
    }

    private func lookup() {
        let result = SourceService.lookup(query: query)
        journal = result.journal
        ccf = result.ccf
        hasSearched = true
    }

    @ViewBuilder
    private func journalCard(_ j: JournalPartition) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("JCR/CAS 分区", systemImage: "chart.bar")
                .font(.headline)

            Text(j.title)
                .font(.subheadline.bold())

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let issn = j.issn {
                    GridRow { Text("ISSN").foregroundStyle(.secondary); Text(issn) }
                }
                if let publisher = j.publisher {
                    GridRow { Text("出版商").foregroundStyle(.secondary); Text(publisher) }
                }
                if let jif = j.jif {
                    GridRow { Text("影响因子").foregroundStyle(.secondary); Text(String(format: "%.3f", jif)) }
                }
                if let quartile = j.jcrQuartile {
                    GridRow { Text("JCR 分区").foregroundStyle(.secondary); Text(quartile) }
                }
                if let casQ = j.casQuartile {
                    GridRow { Text("CAS 分区").foregroundStyle(.secondary); Text(casQ) }
                }
                if j.casTop == true {
                    GridRow { Text("CAS Top").foregroundStyle(.secondary); Text("是").foregroundStyle(.green) }
                }
            }
            .font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    @ViewBuilder
    private func ccfCard(_ c: CCFCatalogEntry) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("CCF 目录", systemImage: "star")
                .font(.headline)

            Text(c.label)
                .font(.subheadline.bold())

            Grid(alignment: .leading, horizontalSpacing: 20, verticalSpacing: 4) {
                if let fullName = c.fullName {
                    GridRow { Text("全称").foregroundStyle(.secondary); Text(fullName).font(.caption) }
                }
                if let rating = c.rating {
                    GridRow { Text("CCF 等级").foregroundStyle(.secondary); Text(rating).foregroundStyle(ratingColor(rating)) }
                }
                if let area = c.area {
                    GridRow { Text("领域").foregroundStyle(.secondary); Text(area) }
                }
                if let kind = Optional(c.kind) {
                    GridRow { Text("类型").foregroundStyle(.secondary); Text(kind) }
                }
            }
            .font(.caption)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }

    private func ratingColor(_ rating: String) -> Color {
        switch rating.uppercased() {
        case "A": return .red
        case "B": return .orange
        case "C": return .blue
        default: return .secondary
        }
    }
}

// MARK: - Translation

private struct TranslationView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var outputText = ""
    @State private var isTranslating = false
    @State private var direction: Direction = .enToZh

    enum Direction: String, CaseIterable {
        case enToZh = "英 → 中"
        case zhToEn = "中 → 英"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("方向", selection: $direction) {
                    ForEach(Direction.allCases, id: \.self) { dir in
                        Text(dir.rawValue).tag(dir)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 150)

                Spacer()

                Button(action: translate) {
                    if isTranslating {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("翻译")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isTranslating)
            }
            .padding()

            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(direction == .enToZh ? "英文原文" : "中文原文")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextEditor(text: $inputText)
                        .font(.body)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(direction == .enToZh ? "中文译文" : "英文译文")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        if !outputText.isEmpty {
                            Button("复制") {
                                NSPasteboard.general.clearContents()
                                NSPasteboard.general.setString(outputText, forType: .string)
                            }
                            .font(.caption)
                        }
                    }
                    TextEditor(text: .constant(outputText))
                        .font(.body)
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                }
            }
            .padding(.horizontal)
            .padding(.bottom)
        }
    }

    private func translate() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isTranslating = true
        outputText = ""

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                outputText = "请先在设置中配置 LLM 提供商。"
                isTranslating = false
                return
            }

            let systemPrompt: String
            switch direction {
            case .enToZh:
                systemPrompt = "你是学术翻译专家。将以下英文翻译为准确、流畅的中文，保持学术术语的专业性。"
            case .zhToEn:
                systemPrompt = "你是学术翻译专家。将以下中文翻译为准确、地道的英文，保持学术术语的专业性。"
            }

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: inputText)],
                    systemPrompt: systemPrompt
                )
                outputText = response
            } catch {
                outputText = "翻译失败: \(error.localizedDescription)"
            }
            isTranslating = false
        }
    }
}
