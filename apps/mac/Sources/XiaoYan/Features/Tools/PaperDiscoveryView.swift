import SwiftUI

struct PaperDiscoveryView: View {
    @State private var topic = ""
    @State private var allTerms = ""
    @State private var titleTerms = ""
    @State private var abstractTerms = ""
    @State private var authors = ""
    @State private var commentsTerms = ""
    @State private var excludeTerms = ""
    @State private var selectedDomains: Set<String> = []
    @State private var venueType = "all"
    @State private var selectedRanks: Set<String> = []
    @State private var days = "14"
    @State private var limit = "6"
    @State private var mode = "relevance"
    @State private var isSearching = false
    @State private var errorMessage: String?
    @State private var results: [DiscoveryResult] = []
    @State private var expandedDomains = true

    private let modeOptions = [
        ("relevance", "最相关", "优先找和关键词最贴合、最适合当前阅读的论文。"),
        ("submittedDate", "最新提交", "按 arXiv 提交时间排序，优先显示最近发表的论文。"),
    ]

    var hasSearchTerms: Bool {
        !allTerms.isEmpty || !titleTerms.isEmpty || !abstractTerms.isEmpty || !authors.isEmpty || !commentsTerms.isEmpty
    }

    private var computedVenues: (categories: [String], journalTerms: [String]) {
        DiscoveryVenueData.computeStaticVenues(
            domains: Array(selectedDomains),
            type: venueType,
            ranks: Array(selectedRanks)
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection
                    searchFieldsSection
                    filterSection
                    actionSection
                    if let error = errorMessage {
                        errorView(error)
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !results.isEmpty {
                Divider()
                resultsSection
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "globe")
                    .font(.title2)
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("论文发现")
                        .font(.title2.bold())
                    Text("联网检索全网论文，按相关性与研究价值排序")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 2) {
                    Text("论文智能检索模块")
                        .font(.subheadline.bold())
                    Text("支持关键词、标题、摘要、作者、排除词组合检索")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .background(Color.blue.opacity(0.06))
            .cornerRadius(10)
        }
    }

    // MARK: - Search Fields

    private var searchFieldsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("研究主题说明（可选）", text: $topic, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(2...3)

            Text("检索词")
                .font(.subheadline.bold())
            Text("通用、标题、摘要、作者、扩展词中至少填写一项")
                .font(.caption)
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                TextField("通用关键词", text: $allTerms)
                    .textFieldStyle(.roundedBorder)
                TextField("标题关键词", text: $titleTerms)
                    .textFieldStyle(.roundedBorder)
                TextField("摘要关键词", text: $abstractTerms)
                    .textFieldStyle(.roundedBorder)
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                TextField("作者", text: $authors)
                    .textFieldStyle(.roundedBorder)
                TextField("扩展关键词", text: $commentsTerms)
                    .textFieldStyle(.roundedBorder)
                TextField("排除词", text: $excludeTerms)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    // MARK: - Filter Section

    private var filterSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Button(action: { expandedDomains.toggle() }) {
                HStack {
                    Text("领域与等级筛选")
                        .font(.subheadline.bold())
                    Spacer()
                    Image(systemName: expandedDomains ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)

            if expandedDomains {
                // CS Groups
                VStack(alignment: .leading, spacing: 8) {
                    Text("计算机科学")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)

                    ForEach(DiscoveryVenueData.csGroups) { group in
                        HStack(spacing: 6) {
                            let groupKeys = group.keys
                            let allSelected = groupKeys.allSatisfy { selectedDomains.contains($0) }
                            let someSelected = groupKeys.contains { selectedDomains.contains($0) }

                            Button(action: {
                                if allSelected {
                                    groupKeys.forEach { selectedDomains.remove($0) }
                                } else {
                                    groupKeys.forEach { selectedDomains.insert($0) }
                                }
                            }) {
                                Text(group.label)
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(allSelected ? Color.blue : someSelected ? Color.blue.opacity(0.15) : Color(nsColor: .controlBackgroundColor))
                                    .foregroundStyle(allSelected ? .white : someSelected ? .blue : .secondary)
                                    .cornerRadius(6)
                            }
                            .buttonStyle(.plain)

                            Text("›")
                                .font(.caption2)
                                .foregroundStyle(.secondary)

                            ForEach(group.keys, id: \.self) { key in
                                if let domain = DiscoveryVenueData.domains.first(where: { $0.id == key }) {
                                    Button(action: {
                                        if selectedDomains.contains(key) {
                                            selectedDomains.remove(key)
                                        } else {
                                            selectedDomains.insert(key)
                                        }
                                    }) {
                                        Text(domain.label)
                                            .font(.caption2)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 3)
                                            .background(selectedDomains.contains(key) ? Color.blue : Color(nsColor: .controlBackgroundColor))
                                            .foregroundStyle(selectedDomains.contains(key) ? .white : .primary)
                                            .cornerRadius(6)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }

                // Non-CS
                VStack(alignment: .leading, spacing: 8) {
                    Text("其他领域")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    FlowLayout(spacing: 6) {
                        ForEach(DiscoveryVenueData.nonCSKeys, id: \.self) { key in
                            if let domain = DiscoveryVenueData.domains.first(where: { $0.id == key }) {
                                Button(action: {
                                    if selectedDomains.contains(key) {
                                        selectedDomains.remove(key)
                                    } else {
                                        selectedDomains.insert(key)
                                    }
                                }) {
                                    Text(domain.label)
                                        .font(.caption2)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(selectedDomains.contains(key) ? Color.blue : Color(nsColor: .controlBackgroundColor))
                                        .foregroundStyle(selectedDomains.contains(key) ? .white : .primary)
                                        .cornerRadius(6)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if !selectedDomains.isEmpty {
                    // Venue type
                    VStack(alignment: .leading, spacing: 6) {
                        Text("类型")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Picker("类型", selection: $venueType) {
                            Text("全部").tag("all")
                            Text("会议").tag("conference")
                            Text("期刊").tag("journal")
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 240)
                    }

                    // Ranks
                    VStack(alignment: .leading, spacing: 6) {
                        Text("等级")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        FlowLayout(spacing: 6) {
                            ForEach(DiscoveryVenueData.rankOptions) { option in
                                Button(action: {
                                    if selectedRanks.contains(option.id) {
                                        selectedRanks.remove(option.id)
                                    } else {
                                        selectedRanks.insert(option.id)
                                    }
                                }) {
                                    Text(option.label)
                                        .font(.caption2.bold())
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 3)
                                        .background(selectedRanks.contains(option.id) ? Color(hex: option.color) : Color(hex: option.color).opacity(0.12))
                                        .foregroundStyle(selectedRanks.contains(option.id) ? .white : Color(hex: option.color))
                                        .cornerRadius(6)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    let venues = computedVenues
                    Text("已匹配 \(venues.journalTerms.count) 个会议/期刊，\(venues.categories.count) 个 arXiv 分类")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Actions

    private var actionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                TextField("最近天数", text: $days)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                TextField("返回篇数", text: $limit)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)

                Picker("排序", selection: $mode) {
                    ForEach(modeOptions, id: \.0) { opt in
                        Text(opt.1).tag(opt.0)
                    }
                }
                .frame(width: 140)

                Spacer()

                Button(action: search) {
                    if isSearching {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.small)
                            Text("检索中...")
                        }
                    } else {
                        HStack(spacing: 6) {
                            Image(systemName: "magnifyingglass")
                            Text("联网检索论文")
                        }
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!hasSearchTerms || isSearching)
            }

            Text("当前模式：\(modeOptions.first(where: { $0.0 == mode })?.1 ?? "") — \(modeOptions.first(where: { $0.0 == mode })?.2 ?? "")")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func errorView(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.08))
        .cornerRadius(8)
    }

    // MARK: - Results

    private var resultsSection: some View {
        VStack(spacing: 0) {
            HStack {
                Text("检索结果 · \(results.count) 篇")
                    .font(.subheadline.bold())
                Spacer()
            }
            .padding()

            Divider()

            List(results) { entry in
                DiscoveryResultRow(result: entry)
            }
            .listStyle(.plain)
        }
    }

    // MARK: - Search Logic

    private func search() {
        guard hasSearchTerms else { return }
        isSearching = true
        errorMessage = nil
        results = []

        Task {
            do {
                var parts: [String] = []
                if !allTerms.isEmpty {
                    let terms = splitTerms(allTerms)
                    parts.append("(\(terms.map { "all:\($0)" }.joined(separator: "+OR+")))")
                }
                if !titleTerms.isEmpty {
                    let terms = splitTerms(titleTerms)
                    parts.append("(\(terms.map { "ti:\($0)" }.joined(separator: "+OR+")))")
                }
                if !abstractTerms.isEmpty {
                    let terms = splitTerms(abstractTerms)
                    parts.append("(\(terms.map { "abs:\($0)" }.joined(separator: "+OR+")))")
                }
                if !authors.isEmpty {
                    let terms = splitTerms(authors)
                    parts.append("(\(terms.map { "au:\($0)" }.joined(separator: "+OR+")))")
                }
                if !commentsTerms.isEmpty {
                    let terms = splitTerms(commentsTerms)
                    parts.append("(\(terms.map { "co:\($0)" }.joined(separator: "+OR+")))")
                }
                if !excludeTerms.isEmpty {
                    let terms = splitTerms(excludeTerms)
                    parts.append("(\(terms.map { "NOT+all:\($0)" }.joined(separator: "+AND+")))")
                }

                let venues = computedVenues
                if !venues.categories.isEmpty {
                    parts.append("(\(venues.categories.map { "cat:\($0)" }.joined(separator: "+OR+")))")
                }

                let query = parts.joined(separator: "+AND+")
                let maxResults = Int(limit) ?? 6
                let entries = try await ArxivClient.search(query: query, maxResults: maxResults, sortBy: mode)
                await MainActor.run {
                    results = entries.map {
                        DiscoveryResult(
                            id: $0.id,
                            title: $0.title,
                            authors: $0.authors,
                            summary: $0.summary,
                            published: $0.published,
                            categories: $0.categories,
                            pdfURL: $0.pdfURL
                        )
                    }
                    isSearching = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "检索失败: \(error.localizedDescription)"
                    isSearching = false
                }
            }
        }
    }

    private func splitTerms(_ value: String) -> [String] {
        let separators = CharacterSet(charactersIn: ",，;；\n")
        return value.components(separatedBy: separators)
            .map { $0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression) }
            .filter { !$0.isEmpty }
    }
}

// MARK: - Result Row

private struct DiscoveryResultRow: View {
    let result: DiscoveryResult
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(result.title)
                .font(.subheadline.bold())
                .lineLimit(isExpanded ? nil : 2)

            if !result.authors.isEmpty {
                Text(result.authors.joined(separator: ", "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(isExpanded ? nil : 1)
            }

            if isExpanded {
                Text(result.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack(spacing: 6) {
                    ForEach(result.categories.prefix(4), id: \.self) { cat in
                        Text(cat)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }
                    Spacer()
                    if let pdf = result.pdfURL, let url = URL(string: pdf) {
                        Link("PDF", destination: url)
                            .font(.caption)
                    }
                }
            }

            if let published = result.published {
                Text(published.prefix(10))
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture { isExpanded.toggle() }
    }
}

// MARK: - Flow Layout (reuse from PlannerView)

// Make CSGroup Identifiable
extension CSGroup: Identifiable {
    var id: String { label }
}
