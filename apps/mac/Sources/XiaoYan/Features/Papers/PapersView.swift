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

// MARK: - Paper Detail

struct PaperDetailView: View {
    let paper: Paper
    let paperService: PaperService
    let settings: AppSettings
    let router: AppRouter
    let onUpdate: () -> Void

    @State private var paperDetail: Paper?
    @State private var activeTab: Tab = .analysis
    @State private var isAnalyzing = false
    @State private var isReproducing = false
    @State private var errorMessage: String?

    enum Tab: String, CaseIterable {
        case analysis = "论文精读"
        case reproduction = "复现指导"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                headerSection
                actionButtons

                if let error = errorMessage {
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                        Text(error)
                            .font(.caption)
                        Spacer()
                    }
                    .padding(10)
                    .background(Color.red.opacity(0.08))
                    .cornerRadius(8)
                }

                if hasAnalysis || hasReproduction {
                    tabPicker
                    contentSection
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("论文详情")
        .onAppear { loadDetail() }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(paperDetail?.title ?? paper.title)
                .font(.title2.bold())

            if let authors = paperDetail?.authors, !authors.isEmpty {
                Text(authors.joined(separator: ", "))
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                if let year = paperDetail?.year {
                    BadgeView(text: "\(year)", color: .blue)
                }
                if let venue = paperDetail?.venue {
                    BadgeView(text: venue, color: .secondary)
                }
                BadgeView(
                    text: (paperDetail?.status ?? paper.status).rawValue,
                    color: statusColor(paperDetail?.status ?? paper.status)
                )
            }

            if let abstract = paperDetail?.abstractText {
                VStack(alignment: .leading, spacing: 4) {
                    Text("摘要")
                        .font(.headline)
                    Text(abstract)
                        .font(.body)
                        .textSelection(.enabled)
                }
                .padding(.top, 4)
            }
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 12) {
            if !hasAnalysis {
                Button(action: analyzePaper) {
                    HStack(spacing: 6) {
                        if isAnalyzing {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "sparkles")
                        }
                        Text(isAnalyzing ? "分析中..." : "开始精读分析")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isAnalyzing || isReproducing)
            }

            if hasAnalysis && !hasReproduction {
                Button(action: reproducePaper) {
                    HStack(spacing: 6) {
                        if isReproducing {
                            ProgressView().controlSize(.small)
                        } else {
                            Image(systemName: "flask")
                        }
                        Text(isReproducing ? "生成中..." : "生成复现指导")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(isAnalyzing || isReproducing)
            }

            Button(action: openChat) {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left")
                    Text("对话")
                }
            }
            .buttonStyle(.bordered)

            Spacer()
        }
    }

    private var tabPicker: some View {
        Picker("", selection: $activeTab) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Text(tab.rawValue).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 300)
    }

    @ViewBuilder
    private var contentSection: some View {
        if activeTab == .analysis, let analysis = paperDetail?.analysis {
            analysisView(analysis)
        } else if activeTab == .reproduction, let guide = paperDetail?.reproductionGuide {
            reproductionView(guide)
        }
    }

    private func analysisView(_ analysis: PaperAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            AnalysisSection(title: "研究问题", icon: "lightbulb", color: .orange, content: analysis.researchQuestion)
            AnalysisSection(title: "核心方法", icon: "command", color: .blue, content: analysis.coreMethod)
            AnalysisSection(title: "实验设计", icon: "flask", color: .purple, content: analysis.experimentDesign)
            AnalysisSection(title: "创新点", icon: "sparkles", color: .green, content: analysis.innovations)
            AnalysisSection(title: "局限性", icon: "exclamationmark.triangle", color: .yellow, content: analysis.limitations)
            AnalysisSection(title: "关键结论", icon: "checkmark.circle", color: .teal, content: analysis.keyConclusions)

            if let raw = analysis.rawAnalysis {
                DisclosureGroup("原始分析") {
                    Text(raw)
                        .font(.caption)
                        .textSelection(.enabled)
                        .padding(.top, 4)
                }
                .disclosureGroupStyle(TransparentDisclosureStyle())
            }
        }
    }

    private func reproductionView(_ guide: ReproductionGuide) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            AnalysisSection(title: "环境配置", icon: "gearshape", color: .blue, content: guide.environmentSetup)
            AnalysisSection(title: "依赖安装", icon: "puzzlepiece", color: .gray, content: guide.dependencies)
            AnalysisSection(title: "数据集准备", icon: "folder", color: .purple, content: guide.dataRequirements)
            AnalysisSection(title: "复现步骤", icon: "list.number", color: .green, content: guide.reproductionSteps)
            AnalysisSection(title: "预期结果", icon: "checkmark.seal", color: .teal, content: guide.expectedResults)
            AnalysisSection(title: "常见问题", icon: "xmark.octagon", color: .red, content: guide.commonPitfalls)

            if let repo = guide.codeRepository {
                HStack {
                    Image(systemName: "link")
                        .foregroundStyle(.blue)
                    Text(repo)
                        .font(.caption)
                        .textSelection(.enabled)
                    Spacer()
                }
                .padding(10)
                .background(Color.blue.opacity(0.06))
                .cornerRadius(8)
            }
        }
    }

    // MARK: - Actions

    private func loadDetail() {
        paperDetail = paperService.get(id: paper.id)
        if hasAnalysis && !hasReproduction {
            activeTab = .analysis
        } else if hasReproduction {
            activeTab = .reproduction
        }
    }

    private func analyzePaper() {
        isAnalyzing = true
        errorMessage = nil
        Task {
            await paperService.analyze(paperId: paper.id, settings: settings)
            await MainActor.run {
                isAnalyzing = false
                loadDetail()
                onUpdate()
            }
        }
    }

    private func reproducePaper() {
        isReproducing = true
        errorMessage = nil
        Task {
            await paperService.reproduce(paperId: paper.id, settings: settings)
            await MainActor.run {
                isReproducing = false
                loadDetail()
                onUpdate()
            }
        }
    }

    private func openChat() {
        settings.pendingChatContext = ChatContext(
            type: "paper",
            id: paper.id,
            title: paperDetail?.title ?? paper.title
        )
        router.selectedRoute = .copilot
    }

    private var hasAnalysis: Bool {
        paperDetail?.analysis != nil || paper.analysis != nil
    }

    private var hasReproduction: Bool {
        paperDetail?.reproductionGuide != nil || paper.reproductionGuide != nil
    }

    private func statusColor(_ status: PaperStatus) -> Color {
        switch status {
        case .uploaded: return .orange
        case .parsing: return .blue
        case .parsed: return .green
        case .failed: return .red
        case .analyzed: return .purple
        }
    }
}

// MARK: - Analysis Section

private struct AnalysisSection: View {
    let title: String
    let icon: String
    let color: Color
    let content: String?

    @State private var isExpanded = true

    var body: some View {
        guard let content = content, !content.isEmpty else {
            return AnyView(EmptyView())
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 0) {
                Button(action: { isExpanded.toggle() }) {
                    HStack(spacing: 6) {
                        Image(systemName: icon)
                            .foregroundStyle(color)
                        Text(title)
                            .font(.subheadline.bold())
                        Spacer()
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
                .padding(10)

                if isExpanded {
                    Text(content)
                        .font(.body)
                        .textSelection(.enabled)
                        .padding(.horizontal, 10)
                        .padding(.bottom, 10)
                }
            }
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(10)
        )
    }
}
