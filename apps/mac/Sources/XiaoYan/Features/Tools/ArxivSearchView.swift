import SwiftUI

struct ArxivSearchView: View {
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
