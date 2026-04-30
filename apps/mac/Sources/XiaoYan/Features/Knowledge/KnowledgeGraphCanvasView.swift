import SwiftUI

struct KnowledgeGraphCanvasView: View {
    @StateObject private var knowledgeService = KnowledgeService()
    @StateObject private var paperService = PaperService()
    @State private var claims: [KnowledgeClaim] = []
    @State private var evidenceLinks: [EvidenceLink] = []
    @State private var papers: [Paper] = []
    @State private var notes: [KnowledgeNote] = []
    @State private var interests: [ResearchInterest] = []
    @State private var selectedNode: GraphNode? = nil

    var body: some View {
        HSplitView {
            // Canvas
            canvasArea
                .frame(minWidth: 400)

            // Inspector
            inspectorPanel
                .frame(minWidth: 260, maxWidth: 320)
        }
        .onAppear(perform: loadData)
    }

    // MARK: - Canvas Area

    private var canvasArea: some View {
        VStack(spacing: 0) {
            HStack {
                Text("知识图谱")
                    .font(.headline)
                Spacer()
                HStack(spacing: 8) {
                    legendItem(color: .blue, label: "研究方向")
                    legendItem(color: .green, label: "论断")
                    legendItem(color: .purple, label: "论文")
                    legendItem(color: .orange, label: "笔记")
                }
                Button(action: loadData) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
            }
            .padding()

            Divider()

            if allNodes.isEmpty {
                ContentUnavailableView("暂无可视化关系", systemImage: "network")
            } else {
                ScrollView {
                    HStack(alignment: .top, spacing: 16) {
                        // Column 1: Interests
                        VStack(spacing: 12) {
                            Text("研究方向")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            ForEach(interests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) }) { node in
                                nodeCard(node)
                            }
                        }
                        .frame(minWidth: 160)

                        // Column 2: Claims
                        VStack(spacing: 12) {
                            Text("论断")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            ForEach(claims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) }) { node in
                                nodeCard(node)
                            }
                        }
                        .frame(minWidth: 180)

                        // Column 3: Evidence (Papers + Notes)
                        VStack(spacing: 12) {
                            Text("证据")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            ForEach(papers.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }) { node in
                                nodeCard(node)
                            }
                            ForEach(notes.map { GraphNode(id: $0.id, label: $0.title, type: .note) }) { node in
                                nodeCard(node)
                            }
                        }
                        .frame(minWidth: 180)
                    }
                    .padding()
                }
            }
        }
    }

    // MARK: - Node Card

    private func nodeCard(_ node: GraphNode) -> some View {
        Button(action: { selectedNode = node }) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Circle()
                        .fill(nodeColor(node.type))
                        .frame(width: 8, height: 8)
                    Text(node.label)
                        .font(.caption.bold())
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    Spacer()
                }
                Text(nodeTypeLabel(node.type))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selectedNode?.id == node.id ? nodeColor(node.type).opacity(0.15) : Color(nsColor: .controlBackgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(selectedNode?.id == node.id ? nodeColor(node.type) : Color.clear, lineWidth: 1.5)
            )
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Inspector Panel

    private var inspectorPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("图谱检视")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text("节点详情")
                        .font(.headline)
                }
                Spacer()
            }
            .padding(.horizontal)
            .padding(.top)

            Divider()

            ScrollView {
                if let node = selectedNode {
                    nodeInspector(node)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "cursorarrow.click")
                            .font(.system(size: 32))
                            .foregroundStyle(.secondary)
                        Text("点击节点查看详情与关联")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.top, 40)
                }
            }
            .padding(.horizontal)
        }
    }

    private func nodeInspector(_ node: GraphNode) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Circle()
                    .fill(nodeColor(node.type))
                    .frame(width: 10, height: 10)
                Text(node.label)
                    .font(.subheadline.bold())
                Spacer()
            }

            Text(nodeTypeLabel(node.type))
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(nodeColor(node.type).opacity(0.12))
                .foregroundColor(nodeColor(node.type))
                .cornerRadius(4)

            // Relations
            let related = relatedLinks(for: node)
            if !related.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("关联证据")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(related) { link in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Image(systemName: relationIcon(link.relationKind))
                                    .foregroundStyle(relationColor(link.relationKind))
                                    .font(.caption2)
                                Text(link.sourceKind)
                                    .font(.caption.bold())
                            }
                            if let summary = link.evidenceSummary {
                                Text(summary)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .padding(8)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }
                }
            }

            // Stats
            HStack(spacing: 16) {
                statItem(label: "出边", value: "\(outgoingLinks(for: node).count)")
                statItem(label: "入边", value: "\(incomingLinks(for: node).count)")
            }
        }
    }

    private func statItem(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.subheadline.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Helpers

    private var allNodes: [GraphNode] {
        let interestNodes = interests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) }
        let claimNodes = claims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) }
        let paperNodes = papers.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }
        let noteNodes = notes.map { GraphNode(id: $0.id, label: $0.title, type: .note) }
        return interestNodes + claimNodes + paperNodes + noteNodes
    }

    private func relatedLinks(for node: GraphNode) -> [EvidenceLink] {
        evidenceLinks.filter { $0.claimId == node.id || $0.sourceId == node.id }
    }

    private func outgoingLinks(for node: GraphNode) -> [EvidenceLink] {
        evidenceLinks.filter { $0.sourceId == node.id }
    }

    private func incomingLinks(for node: GraphNode) -> [EvidenceLink] {
        evidenceLinks.filter { $0.claimId == node.id }
    }

    private func nodeColor(_ type: NodeType) -> Color {
        switch type {
        case .interest: return .blue
        case .claim: return .green
        case .paper: return .purple
        case .note: return .orange
        case .experiment: return .red
        }
    }

    private func nodeTypeLabel(_ type: NodeType) -> String {
        switch type {
        case .interest: return "研究方向"
        case .claim: return "论断"
        case .paper: return "论文"
        case .note: return "笔记"
        case .experiment: return "实验"
        }
    }

    private func relationIcon(_ kind: String) -> String {
        switch kind {
        case "supports": return "checkmark.circle"
        case "contradicts": return "xmark.circle"
        default: return "link"
        }
    }

    private func relationColor(_ kind: String) -> Color {
        switch kind {
        case "supports": return .green
        case "contradicts": return .red
        default: return .blue
        }
    }

    private func loadData() {
        claims = (try? KnowledgeRepository().listClaims()) ?? []
        evidenceLinks = claims.flatMap { claim in
            (try? KnowledgeRepository().listEvidenceLinks(claimId: claim.id)) ?? []
        }
        interests = knowledgeService.listInterests()
        papers = paperService.list()
        notes = knowledgeService.listNotes()
    }
}

