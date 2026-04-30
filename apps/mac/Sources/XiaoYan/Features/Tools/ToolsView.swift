import SwiftUI
import UniformTypeIdentifiers

struct ToolsView: View {
    @State private var selectedTab: Tab = .arxiv

    enum Tab: String, CaseIterable {
        case arxiv = "arXiv 搜索"
        case sourceLookup = "期刊查询"
        case translation = "学术翻译"
        case markdown = "Markdown 整理"
        case friendLinks = "科研友链"
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
            case .markdown: MarkdownFormatterView()
            case .friendLinks: FriendLinksView()
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

// MARK: - Markdown Formatter

private struct MarkdownFormatterView: View {
    @EnvironmentObject var settings: AppSettings
    @State private var inputText = ""
    @State private var resultText = ""
    @State private var isProcessing = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack(spacing: 12) {
                Image(systemName: "doc.text")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Markdown 整理")
                        .font(.headline)
                    Text("粘贴任意文本，小妍帮你整理为规范的 Markdown 格式")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            .padding()

            Divider()

            // Input
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("待整理内容")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if !inputText.isEmpty {
                        Text("\(inputText.count) 字 · 预计 \(max(1, Int(ceil(Double(inputText.count) / 1500.0)))) 块")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                TextEditor(text: $inputText)
                    .font(.body)
                    .padding(4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                    .frame(minHeight: 120)
            }
            .padding()

            // Actions
            HStack {
                Spacer()
                Button(action: formatMarkdown) {
                    if isProcessing {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("整理中…")
                        }
                    } else {
                        HStack(spacing: 6) {
                            Image(systemName: "doc.text")
                            Text("开始整理")
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isProcessing)
            }
            .padding(.horizontal)

            if let error = errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                    Spacer()
                }
                .padding(8)
                .background(Color.red.opacity(0.08))
                .cornerRadius(8)
                .padding(.horizontal)
            }

            // Result
            if !resultText.isEmpty {
                Divider().padding(.vertical, 8)

                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("整理结果")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Button("复制") {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(resultText, forType: .string)
                        }
                        .font(.caption)
                        Button("保存为 .md") {
                            saveResult()
                        }
                        .font(.caption)
                    }
                    TextEditor(text: .constant(resultText))
                        .font(.system(.body, design: .monospaced))
                        .padding(4)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                        .frame(minHeight: 120)
                }
                .padding()
            }

            Spacer()
        }
    }

    private func formatMarkdown() {
        guard !inputText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        isProcessing = true
        errorMessage = nil
        resultText = ""

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                errorMessage = "请先在设置中配置 LLM 提供商。"
                isProcessing = false
                return
            }

            let systemPrompt = """
            你是一位 Markdown 格式整理专家。请将用户提供的文本整理为规范、整洁的 Markdown 格式。
            要求：
            - 保持原文的核心内容和语义不变
            - 使用合适的标题层级、列表、引用等 Markdown 语法
            - 段落之间保留适当的空行
            - 代码块使用 ``` 包裹并标注语言
            - 输出纯 Markdown 文本，不要添加解释性文字
            """

            do {
                let response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: inputText)],
                    systemPrompt: systemPrompt
                )
                resultText = response
            } catch {
                errorMessage = "整理失败: \(error.localizedDescription)"
            }
            isProcessing = false
        }
    }

    private func saveResult() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType.plainText]
        panel.nameFieldStringValue = "整理结果.md"
        panel.begin { result in
            if result == .OK, let url = panel.url {
                try? resultText.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }
}

// MARK: - Friend Links

private struct FriendLinkSection {
    let title: String
    let items: [FriendLinkItem]
}

private struct FriendLinkItem {
    let name: String
    let href: String
}

private let friendLinkSections: [FriendLinkSection] = [
    FriendLinkSection(title: "主流 AI 助手", items: [
        FriendLinkItem(name: "ChatGPT", href: "https://chatgpt.com/"),
        FriendLinkItem(name: "Claude", href: "https://claude.ai/"),
        FriendLinkItem(name: "Gemini", href: "https://gemini.google.com/"),
        FriendLinkItem(name: "DeepSeek", href: "https://chat.deepseek.com/"),
        FriendLinkItem(name: "Kimi", href: "https://kimi.moonshot.cn/"),
        FriendLinkItem(name: "通义千问", href: "https://tongyi.aliyun.com/"),
        FriendLinkItem(name: "Perplexity", href: "https://www.perplexity.ai/"),
    ]),
    FriendLinkSection(title: "AI 学术工具", items: [
        FriendLinkItem(name: "Semantic Scholar", href: "https://www.semanticscholar.org/"),
        FriendLinkItem(name: "Elicit", href: "https://elicit.com/"),
        FriendLinkItem(name: "Consensus", href: "https://consensus.app/"),
        FriendLinkItem(name: "Connected Papers", href: "https://www.connectedpapers.com/"),
        FriendLinkItem(name: "SciSpace", href: "https://typeset.io/"),
    ]),
    FriendLinkSection(title: "论文检索", items: [
        FriendLinkItem(name: "arXiv", href: "https://arxiv.org/"),
        FriendLinkItem(name: "Google Scholar", href: "https://scholar.google.com/"),
        FriendLinkItem(name: "DBLP", href: "https://dblp.org/"),
        FriendLinkItem(name: "PubMed", href: "https://pubmed.ncbi.nlm.nih.gov/"),
        FriendLinkItem(name: "Web of Science", href: "https://www.webofscience.com/"),
    ]),
    FriendLinkSection(title: "代码与数据", items: [
        FriendLinkItem(name: "GitHub", href: "https://github.com/"),
        FriendLinkItem(name: "Hugging Face", href: "https://huggingface.co/"),
        FriendLinkItem(name: "Papers with Code", href: "https://paperswithcode.com/"),
        FriendLinkItem(name: "Kaggle", href: "https://www.kaggle.com/"),
        FriendLinkItem(name: "Zenodo", href: "https://zenodo.org/"),
    ]),
    FriendLinkSection(title: "写作与投稿", items: [
        FriendLinkItem(name: "Overleaf", href: "https://www.overleaf.com/"),
        FriendLinkItem(name: "Grammarly", href: "https://www.grammarly.com/"),
        FriendLinkItem(name: "LanguageTool", href: "https://languagetool.org/"),
        FriendLinkItem(name: "QuillBot", href: "https://quillbot.com/"),
        FriendLinkItem(name: "知网", href: "https://www.cnki.net/"),
    ]),
]

private struct FriendLinksView: View {
    @State private var expandedSections: Set<String> = Set(friendLinkSections.map(\.title))

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .font(.title3)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("科研友链")
                        .font(.headline)
                    Text("\(friendLinkSections.reduce(0) { $0 + $1.items.count }) 条链接 · \(friendLinkSections.count) 个分类")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button(expandedSections.count == friendLinkSections.count ? "收起全部" : "展开全部") {
                    if expandedSections.count == friendLinkSections.count {
                        expandedSections.removeAll()
                    } else {
                        expandedSections = Set(friendLinkSections.map(\.title))
                    }
                }
                .font(.caption)
            }
            .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(friendLinkSections, id: \.title) { section in
                        FriendLinkSectionView(
                            section: section,
                            isExpanded: expandedSections.contains(section.title)
                        ) {
                            if expandedSections.contains(section.title) {
                                expandedSections.remove(section.title)
                            } else {
                                expandedSections.insert(section.title)
                            }
                        }
                    }
                }
                .padding()
            }
        }
    }
}

private struct FriendLinkSectionView: View {
    let section: FriendLinkSection
    let isExpanded: Bool
    let toggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack {
                    Text(section.title)
                        .font(.subheadline.bold())
                    Text("\(section.items.count) 条")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(4)
                    Spacer()
                    Text(isExpanded ? "收起" : "展开")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(10)

            if isExpanded {
                Divider()
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 180))], spacing: 8) {
                    ForEach(section.items, id: \.name) { item in
                        Link(destination: URL(string: item.href)!) {
                            HStack(spacing: 8) {
                                Image(systemName: "link.circle")
                                    .foregroundStyle(.blue)
                                Text(item.name)
                                    .font(.subheadline)
                                Spacer()
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(10)
            }
        }
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(10)
    }
}
