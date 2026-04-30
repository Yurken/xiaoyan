import SwiftUI
import UniformTypeIdentifiers

struct PapersView: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var router: AppRouter
    @StateObject private var paperService = PaperService()
    @State private var papers: [Paper] = []
    @State private var selectedPaper: Paper?
    @State private var showingImporter = false
    @State private var searchText = ""

    var filteredPapers: [Paper] {
        if searchText.isEmpty { return papers }
        return papers.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            $0.authors.joined().localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("搜索论文...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(8)
                .padding()

                List(filteredPapers, selection: $selectedPaper) { paper in
                    PaperRow(paper: paper)
                        .tag(paper)
                }
                .listStyle(.sidebar)
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
            allowedContentTypes: [.pdf]
        ) { result in
            if case .success(let url) = result {
                Task {
                    _ = await paperService.upload(fileURL: url, settings: settings)
                    reloadPapers()
                }
            }
        }
        .onAppear { reloadPapers() }
    }

    private func reloadPapers() {
        papers = paperService.list()
        if let selected = selectedPaper {
            selectedPaper = papers.first { $0.id == selected.id }
        }
    }
}

// MARK: - Paper Row

struct PaperRow: View {
    let paper: Paper

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(paper.title)
                .font(.subheadline.bold())
                .lineLimit(2)
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
}
