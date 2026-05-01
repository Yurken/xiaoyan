import SwiftUI

struct KnowledgeGraphCanvasView: View {
    @StateObject private var knowledgeService = KnowledgeService()
    @StateObject private var editor = KnowledgeGraphEditor()
    @State private var snapshot: KnowledgeGraphSnapshot?
    @State private var selectedNode: GraphNode? = nil
    @State private var showingCreateClaim = false
    private let repo = KnowledgeRepository()

    private var claims: [KnowledgeClaim] { snapshot?.claims ?? [] }
    private var evidenceLinks: [EvidenceLink] { snapshot?.evidenceLinks ?? [] }
    private var papers: [Paper] { snapshot?.papers ?? [] }
    private var notes: [KnowledgeNote] { snapshot?.notes ?? [] }
    private var interests: [ResearchInterest] { snapshot?.interests ?? [] }
    private var experiments: [ExperimentRecord] { snapshot?.experiments ?? [] }
    private var citations: [PaperCitation] { snapshot?.citations ?? [] }

    var body: some View {
        HSplitView {
            canvasArea
                .frame(minWidth: 400)

            inspectorPanel
                .frame(minWidth: 260, maxWidth: 360)
        }
        .onAppear(perform: loadData)
        .sheet(isPresented: $showingCreateClaim, onDismiss: {
            editor.cancelTool()
        }) {
            CreateClaimSheet { _ in
                loadData()
            }
        }
    }

    // MARK: - Canvas Area

    private var canvasArea: some View {
        VStack(spacing: 0) {
            HStack {
                Text("知识图谱")
                    .font(.headline)
                Spacer()
                if let summary = snapshot?.summary {
                    HStack(spacing: 10) {
                        summaryItem(label: "方向", value: summary.interestCount)
                        summaryItem(label: "论文", value: summary.paperCount)
                        summaryItem(label: "笔记", value: summary.noteCount)
                        summaryItem(label: "实验", value: summary.experimentCount)
                        summaryItem(label: "论断", value: summary.claimCount)
                        summaryItem(label: "证据", value: summary.evidenceCount)
                        summaryItem(label: "引用", value: summary.citationCount)
                    }
                }
                Button(action: { editor.toggleEdit() }) {
                    Image(systemName: editor.isEditing ? "checkmark.square" : "square.and.pencil")
                }
                .buttonStyle(.borderless)
                .help(editor.isEditing ? "退出编辑" : "进入编辑模式")

                Button(action: loadData) {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
            }
            .padding()

            if editor.isEditing {
                editorToolbar
                Divider()
            } else {
                Divider()
            }

            if allNodes.isEmpty {
                ContentUnavailableView("暂无可视化关系", systemImage: "network")
            } else {
                ScrollView {
                    HStack(alignment: .top, spacing: 16) {
                        column(title: "研究方向", nodes: interests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) })
                        column(title: "论断", nodes: claims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) })
                        column(title: "证据", nodes: papers.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }
                            + notes.map { GraphNode(id: $0.id, label: $0.title, type: .note) }
                            + experiments.map { GraphNode(id: $0.id, label: $0.title, type: .experiment) })
                    }
                    .padding()
                }
            }
        }
    }

    private var editorToolbar: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                ForEach([CanvasTool.addClaim, .linkEvidence, .linkCitation], id: \.self) { tool in
                    toolButton(tool)
                }
                if editor.activeTool != .none {
                    Button {
                        editor.cancelTool()
                    } label: {
                        Label("取消", systemImage: "xmark.circle")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                }
                Spacer()
            }
            if let hint = editor.hint, !hint.isEmpty {
                Text(hint)
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.05))
    }

    @ViewBuilder
    private func toolButton(_ tool: CanvasTool) -> some View {
        Button {
            editor.startTool(tool)
            if tool == .addClaim {
                showingCreateClaim = true
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: tool.icon)
                Text(tool.label)
            }
            .font(.caption.weight(editor.activeTool == tool ? .semibold : .regular))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(editor.activeTool == tool ? Color.accentColor : Color.clear)
            .foregroundStyle(editor.activeTool == tool ? Color.white : Color.primary)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }

    private func column(title: String, nodes: [GraphNode]) -> some View {
        VStack(spacing: 12) {
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            ForEach(nodes) { node in
                nodeCard(node)
            }
        }
        .frame(minWidth: 160)
    }

    private func summaryItem(label: String, value: Int) -> some View {
        VStack(spacing: 0) {
            Text("\(value)")
                .font(.caption.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Node Card

    private func nodeCard(_ node: GraphNode) -> some View {
        let targetability = editor.targetability(for: node)
        let isSelected = selectedNode?.id == node.id
        return Button(action: { handleNodeTap(node) }) {
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
            .background(cardBackground(node: node, isSelected: isSelected, targetability: targetability))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(cardStroke(node: node, isSelected: isSelected, targetability: targetability),
                            lineWidth: targetability == .neutral ? 1.5 : 2)
            )
            .cornerRadius(8)
            .opacity(targetability == .invalid ? 0.45 : 1)
        }
        .buttonStyle(.plain)
    }

    private func cardBackground(node: GraphNode, isSelected: Bool, targetability: NodeTargetability) -> Color {
        switch targetability {
        case .validSource: return Color.orange.opacity(0.18)
        case .validTarget: return Color.green.opacity(0.15)
        case .invalid: return Color(nsColor: .controlBackgroundColor)
        case .neutral:
            return isSelected ? nodeColor(node.type).opacity(0.15) : Color(nsColor: .controlBackgroundColor)
        }
    }

    private func cardStroke(node: GraphNode, isSelected: Bool, targetability: NodeTargetability) -> Color {
        switch targetability {
        case .validSource: return .orange
        case .validTarget: return .green
        case .invalid: return .clear
        case .neutral: return isSelected ? nodeColor(node.type) : .clear
        }
    }

    private func handleNodeTap(_ node: GraphNode) {
        if !editor.isEditing || editor.activeTool == .none {
            selectedNode = node
            return
        }
        // 编辑模式下分发给 editor；C3/C4 提交后会接 sheet
        switch editor.pickNode(node) {
        case .invalidNode, .sourcePicked:
            // 高亮变化由 @Published 自动驱动
            break
        case .readyForSheet(_, _):
            // C1 先不接 sheet，仅取消工具状态
            editor.cancelTool()
        }
    }

    // MARK: - Inspector Panel

    private var inspectorPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
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
                VStack(alignment: .leading, spacing: 16) {
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
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                    }

                    Divider()

                    GraphCitationPanel(
                        citations: citations,
                        papers: papers,
                        onDelete: deleteCitation
                    )

                    Divider()

                    GraphAnalysisPanel()
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
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
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                }
            }

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
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Helpers

    private var allNodes: [GraphNode] {
        interests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) }
            + claims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) }
            + papers.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }
            + notes.map { GraphNode(id: $0.id, label: $0.title, type: .note) }
            + experiments.map { GraphNode(id: $0.id, label: $0.title, type: .experiment) }
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
        snapshot = try? repo.graphSnapshot()
    }

    private func deleteCitation(id: String) {
        try? repo.deleteCitation(id: id)
        loadData()
    }
}
