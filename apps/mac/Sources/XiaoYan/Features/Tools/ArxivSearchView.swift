import SwiftUI

struct ArxivSearchView: View {
    @State private var allTerms = ""
    @State private var titleTerms = ""
    @State private var abstractTerms = ""
    @State private var authors = ""
    @State private var commentsTerms = ""
    @State private var journalTerms = ""
    @State private var excludeTerms = ""
    @State private var selectedCategories: [String] = []
    @State private var showingCategoryPicker = false
    @State private var days = 30
    @State private var limit = 10
    @State private var sortMode: SortMode = .relevance
    @State private var results: [ArxivClient.Entry] = []
    @State private var isSearching = false
    @State private var searchExpression: String?

    enum SortMode: String, CaseIterable {
        case relevance = "最相关"
        case submittedDate = "最新"
    }

    private var hasTerms: Bool {
        !allTerms.trimmingCharacters(in: .whitespaces).isEmpty
            || !titleTerms.trimmingCharacters(in: .whitespaces).isEmpty
            || !abstractTerms.trimmingCharacters(in: .whitespaces).isEmpty
            || !authors.trimmingCharacters(in: .whitespaces).isEmpty
            || !commentsTerms.trimmingCharacters(in: .whitespaces).isEmpty
            || !journalTerms.trimmingCharacters(in: .whitespaces).isEmpty
            || !selectedCategories.isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    searchForm
                    if let expr = searchExpression {
                        Text("检索式: \(expr)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding()
            }

            Divider()

            resultsArea
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "sparkles")
                .font(.title2)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text("arXiv 智能检索")
                    .font(.headline)
                Text("多字段组合检索，自动按最近时间窗口过滤")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    // MARK: - Search Form

    private var searchForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                labeledField("通用关键词 (all)", text: $allTerms)
                labeledField("标题关键词 (ti)", text: $titleTerms)
                labeledField("摘要关键词 (abs)", text: $abstractTerms)
            }

            HStack(spacing: 8) {
                labeledField("作者 (au)", text: $authors)
                labeledField("备注关键词 (co)", text: $commentsTerms)
                labeledField("期刊/会议 (jr)", text: $journalTerms)
            }

            categorySection

            labeledField("排除词 (ANDNOT)", text: $excludeTerms)

            HStack(spacing: 12) {
                HStack(spacing: 4) {
                    Text("最近")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("天", value: $days, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 50)
                    Text("天")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 4) {
                    Text("返回")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("篇", value: $limit, format: .number)
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 50)
                    Text("篇")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Picker("排序", selection: $sortMode) {
                    ForEach(SortMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 160)

                Spacer()

                Button(action: search) {
                    if isSearching {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("检索", systemImage: "magnifyingglass")
                    }
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!hasTerms || isSearching)
            }
        }
    }

    private func labeledField(_ label: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            TextField(label, text: text)
                .textFieldStyle(.roundedBorder)
                .font(.caption)
        }
    }

    // MARK: - Category Section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("arXiv 分类")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Spacer()
                if !selectedCategories.isEmpty {
                    Button("清空") {
                        selectedCategories = []
                    }
                    .font(.caption2)
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }
                Button(showingCategoryPicker ? "收起" : "展开") {
                    showingCategoryPicker.toggle()
                }
                .font(.caption2)
                .buttonStyle(.plain)
            }

            if !selectedCategories.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(selectedCategories, id: \.self) { cat in
                        HStack(spacing: 2) {
                            Text(cat)
                                .font(.caption2)
                            Button {
                                selectedCategories.removeAll { $0 == cat }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.caption2)
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.12))
                        .foregroundColor(.accentColor)
                        .cornerRadius(4)
                    }
                }
            }

            if showingCategoryPicker {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(ARXIV_CATEGORY_GROUPS, id: \.domain) { group in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.domain)
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            FlowLayout(spacing: 6) {
                                ForEach(group.items, id: \.id) { item in
                                    let selected = selectedCategories.contains(item.id)
                                    Button {
                                        if selected {
                                            selectedCategories.removeAll { $0 == item.id }
                                        } else {
                                            selectedCategories.append(item.id)
                                        }
                                    } label: {
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(item.id)
                                                .font(.caption2.bold())
                                            Text(item.zh)
                                                .font(.caption2)
                                                .opacity(selected ? 0.8 : 0.55)
                                        }
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 3)
                                        .background(selected ? Color.accentColor.opacity(0.15) : Theme.Colors.surface)
                                        .foregroundColor(selected ? .accentColor : .secondary)
                                        .cornerRadius(6)
                                    }
                                    .buttonStyle(.plain)
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
        }
    }

    // MARK: - Results

    private var resultsArea: some View {
        Group {
            if results.isEmpty && !isSearching {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 36))
                        .foregroundStyle(.secondary)
                    Text("填写检索条件后点击检索")
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

    // MARK: - Actions

    private func search() {
        guard hasTerms else { return }
        isSearching = true
        results = []

        let request = ArxivClient.SearchRequest(
            allTerms: splitTerms(allTerms),
            titleTerms: splitTerms(titleTerms),
            abstractTerms: splitTerms(abstractTerms),
            authors: splitTerms(authors),
            categories: selectedCategories,
            commentsTerms: splitTerms(commentsTerms),
            journalTerms: splitTerms(journalTerms),
            excludeTerms: splitTerms(excludeTerms)
        )

        let sortKey = sortMode == .relevance ? "relevance" : "submittedDate"

        Task {
            do {
                let entries = try await ArxivClient.search(
                    request: request,
                    days: max(1, days),
                    maxResults: max(1, min(limit, 50)),
                    sortBy: sortKey
                )
                results = entries
                searchExpression = ArxivClient.SearchRequest(
                    allTerms: splitTerms(allTerms),
                    titleTerms: splitTerms(titleTerms),
                    abstractTerms: splitTerms(abstractTerms),
                    authors: splitTerms(authors),
                    categories: selectedCategories,
                    commentsTerms: splitTerms(commentsTerms),
                    journalTerms: splitTerms(journalTerms),
                    excludeTerms: splitTerms(excludeTerms)
                ).hasSearchTerms ? buildExpression(request) : nil
            } catch {
                results = []
            }
            isSearching = false
        }
    }

    private func splitTerms(_ text: String) -> [String] {
        text.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    private func buildExpression(_ request: ArxivClient.SearchRequest) -> String {
        var parts: [String] = []
        if !request.allTerms.isEmpty { parts.append("all:\(request.allTerms.joined(separator: ","))") }
        if !request.titleTerms.isEmpty { parts.append("ti:\(request.titleTerms.joined(separator: ","))") }
        if !request.abstractTerms.isEmpty { parts.append("abs:\(request.abstractTerms.joined(separator: ","))") }
        if !request.authors.isEmpty { parts.append("au:\(request.authors.joined(separator: ","))") }
        if !request.categories.isEmpty { parts.append("cat:\(request.categories.joined(separator: ","))") }
        return parts.joined(separator: " AND ")
    }
}

// MARK: - Category Data

struct ArxivCategoryGroup: Identifiable {
    let id = UUID()
    let domain: String
    let items: [ArxivCategoryItem]
}

struct ArxivCategoryItem: Identifiable {
    let id: String
    let zh: String
}

private let ARXIV_CATEGORY_GROUPS: [ArxivCategoryGroup] = [
    ArxivCategoryGroup(domain: "CS · 人工智能 & 机器学习", items: [
        ArxivCategoryItem(id: "cs.AI", zh: "人工智能"),
        ArxivCategoryItem(id: "cs.LG", zh: "机器学习"),
        ArxivCategoryItem(id: "cs.CL", zh: "计算语言学"),
        ArxivCategoryItem(id: "cs.CV", zh: "计算机视觉"),
        ArxivCategoryItem(id: "cs.NE", zh: "神经与进化计算"),
        ArxivCategoryItem(id: "cs.IR", zh: "信息检索"),
        ArxivCategoryItem(id: "cs.MA", zh: "多智能体系统"),
    ]),
    ArxivCategoryGroup(domain: "CS · 系统 & 工程", items: [
        ArxivCategoryItem(id: "cs.RO", zh: "机器人学"),
        ArxivCategoryItem(id: "cs.SE", zh: "软件工程"),
        ArxivCategoryItem(id: "cs.DB", zh: "数据库"),
        ArxivCategoryItem(id: "cs.DC", zh: "分布式与并行计算"),
        ArxivCategoryItem(id: "cs.CR", zh: "密码学与安全"),
        ArxivCategoryItem(id: "cs.NI", zh: "网络与互联网"),
        ArxivCategoryItem(id: "cs.HC", zh: "人机交互"),
        ArxivCategoryItem(id: "cs.SY", zh: "系统与控制"),
        ArxivCategoryItem(id: "cs.PL", zh: "程序设计语言"),
        ArxivCategoryItem(id: "cs.DS", zh: "数据结构与算法"),
    ]),
    ArxivCategoryGroup(domain: "Stat & Math", items: [
        ArxivCategoryItem(id: "stat.ML", zh: "统计机器学习"),
        ArxivCategoryItem(id: "stat.AP", zh: "统计应用"),
        ArxivCategoryItem(id: "stat.ME", zh: "统计方法论"),
        ArxivCategoryItem(id: "math.OC", zh: "优化与控制"),
        ArxivCategoryItem(id: "math.NA", zh: "数值分析"),
        ArxivCategoryItem(id: "math.PR", zh: "概率论"),
    ]),
    ArxivCategoryGroup(domain: "EESS & 其他", items: [
        ArxivCategoryItem(id: "eess.IV", zh: "图像与视频处理"),
        ArxivCategoryItem(id: "eess.SP", zh: "信号处理"),
        ArxivCategoryItem(id: "eess.AS", zh: "音频与语音处理"),
        ArxivCategoryItem(id: "eess.SY", zh: "电气系统与控制"),
        ArxivCategoryItem(id: "q-bio.NC", zh: "神经元与认知"),
        ArxivCategoryItem(id: "physics.comp-ph", zh: "计算物理"),
    ]),
]

// MARK: - Entry Row

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

