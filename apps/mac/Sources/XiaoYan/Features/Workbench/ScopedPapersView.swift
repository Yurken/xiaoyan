import SwiftUI
import UniformTypeIdentifiers

struct ScopedPapersView: View {
    @EnvironmentObject var router: AppRouter
    let interestId: String
    let papers: [Paper]
    let paperService: PaperService
    let settings: AppSettings
    let onUpdate: () -> Void

    @State private var searchText = ""
    @State private var showingImporter = false
    @State private var selectedPaper: Paper?

    var filteredPapers: [Paper] {
        let scoped = papers.filter { $0.researchInterestId == interestId }
        if searchText.isEmpty { return scoped }
        return scoped.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            $0.authors.joined().localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
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

                Spacer()

                Button(action: { showingImporter = true }) {
                    Label("上传", systemImage: "plus")
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding()

            if filteredPapers.isEmpty {
                emptyState
            } else {
                List(filteredPapers) { paper in
                    Button(action: { selectedPaper = paper }) {
                        PaperRow(paper: paper)
                    }
                    .buttonStyle(.plain)
                }
                .listStyle(.plain)
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
                        let paper = await paperService.upload(fileURL: url, settings: settings)
                        var updated = paper
                        updated.researchInterestId = interestId
                        paperService.update(paper: updated)
                    }
                    onUpdate()
                }
            }
        }
        .sheet(item: $selectedPaper) { paper in
            PaperDetailView(
                paper: paper,
                paperService: paperService,
                settings: settings,
                router: router,
                onUpdate: onUpdate
            )
            .frame(minWidth: 600, minHeight: 500)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("还没有论文")
                .font(.subheadline.bold())
            Text("上传 PDF 论文后，将自动关联到该研究方向。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }
}
