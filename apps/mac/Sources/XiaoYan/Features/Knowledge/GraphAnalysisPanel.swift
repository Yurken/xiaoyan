import SwiftUI

struct GraphAnalysisPanel: View {
    @State private var mode: AnalysisMode = .centrality
    @State private var centralityResults: [CitationCentralityEntry] = []
    @State private var pathFrom = ""
    @State private var pathTo = ""
    @State private var pathResult: CitationPathResult?
    @State private var seedIds = ""
    @State private var subgraphResult: CitationSubgraph?
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let service = CitationGraphService()

    enum AnalysisMode: String, CaseIterable {
        case centrality = "中心性"
        case shortestPath = "最短路径"
        case subgraph = "子图"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("分析模式", selection: $mode) {
                ForEach(AnalysisMode.allCases, id: \.self) { m in
                    Text(m.rawValue).tag(m)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: mode) {
                errorMessage = nil
                if mode == .centrality { loadCentrality() }
            }

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            switch mode {
            case .centrality:
                centralityView
            case .shortestPath:
                shortestPathView
            case .subgraph:
                subgraphView
            }
        }
        .onAppear {
            if mode == .centrality { loadCentrality() }
        }
    }

    // MARK: - Centrality

    private var centralityView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("引用网络中心性排名")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Button(action: loadCentrality) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
            }

            if isLoading {
                ProgressView().controlSize(.small)
            } else if centralityResults.isEmpty {
                Text("暂无引用数据")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(Array(centralityResults.enumerated()), id: \.element.paperId) { index, entry in
                        HStack(spacing: 6) {
                            Text("\(index + 1)")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                                .frame(width: 18, alignment: .trailing)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(entry.title)
                                    .font(.caption.bold())
                                    .lineLimit(1)
                                HStack(spacing: 4) {
                                    Text("被引 \(entry.inDegree)")
                                    Text("·")
                                    Text("引用 \(entry.outDegree)")
                                    if let year = entry.year {
                                        Text("·")
                                        Text("\(year)")
                                    }
                                }
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(String(format: "%.3f", entry.degreeCentrality))
                                .font(.caption2.bold())
                                .foregroundStyle(.blue)
                        }
                        .padding(6)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(6)
                    }
                }
            }
        }
    }

    // MARK: - Shortest Path

    private var shortestPathView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("引用最短路径")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
            }

            TextField("起始论文 ID", text: $pathFrom)
                .font(.caption)
            TextField("目标论文 ID", text: $pathTo)
                .font(.caption)

            HStack {
                Spacer()
                Button("搜索路径") {
                    searchPath()
                }
                .controlSize(.small)
                .disabled(pathFrom.trimmingCharacters(in: .whitespaces).isEmpty || pathTo.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if isLoading {
                ProgressView().controlSize(.small)
            } else if let result = pathResult {
                if result.length == 0 {
                    Text("起始与目标为同一篇论文")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("路径长度: \(result.length)")
                            .font(.caption.bold())
                        ForEach(result.nodes) { node in
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(.purple)
                                    .frame(width: 6, height: 6)
                                Text(node.title)
                                    .font(.caption)
                                    .lineLimit(1)
                                if let year = node.year {
                                    Text("(\(year))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(4)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Subgraph

    private var subgraphView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("局部子图探索")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
            }

            TextField("种子论文 ID（逗号分隔）", text: $seedIds)
                .font(.caption)

            HStack {
                Spacer()
                Button("探索子图") {
                    searchSubgraph()
                }
                .controlSize(.small)
                .disabled(seedIds.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            if isLoading {
                ProgressView().controlSize(.small)
            } else if let result = subgraphResult {
                if result.nodes.isEmpty {
                    Text("未找到相关子图")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("节点 \(result.nodes.count) · 边 \(result.edges.count)")
                            .font(.caption.bold())
                        ForEach(result.nodes) { node in
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(.purple)
                                    .frame(width: 6, height: 6)
                                Text(node.title)
                                    .font(.caption)
                                    .lineLimit(1)
                                if let year = node.year {
                                    Text("(\(year))")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(4)
                        }
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func loadCentrality() {
        isLoading = true
        errorMessage = nil
        Task {
            do {
                let results = try service.centrality(limit: 12)
                await MainActor.run {
                    centralityResults = results
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "加载失败: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }

    private func searchPath() {
        isLoading = true
        errorMessage = nil
        pathResult = nil
        Task {
            do {
                let result = try service.shortestPath(
                    fromPaperId: pathFrom.trimmingCharacters(in: .whitespaces),
                    toPaperId: pathTo.trimmingCharacters(in: .whitespaces)
                )
                await MainActor.run {
                    pathResult = result
                    isLoading = false
                    if result == nil {
                        errorMessage = "未找到路径"
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "搜索失败: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }

    private func searchSubgraph() {
        isLoading = true
        errorMessage = nil
        subgraphResult = nil
        Task {
            do {
                let seeds = seedIds.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                let result = try service.subgraph(seedPaperIds: seeds, radius: 1, maxNodes: 16)
                await MainActor.run {
                    subgraphResult = result
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = "探索失败: \(error.localizedDescription)"
                    isLoading = false
                }
            }
        }
    }
}

extension CitationGraphNode: Identifiable {
    var id: String { paperId }
}
