import SwiftUI

struct KnowledgeGraphCanvasView: View {
    @StateObject private var editor = KnowledgeGraphEditor()
    @State private var snapshot: KnowledgeGraphSnapshot?
    @State private var selectedNode: GraphNode? = nil
    @State private var composerMode: ComposerMode? = nil
    @State private var pendingEvidencePair: EvidenceLinkPair? = nil
    @State private var pendingCitationPair: CitationLinkPair? = nil
    @State private var canvasScale: CGFloat = 1.0
    @State private var canvasOffset: CGSize = .zero
    @State private var lastScale: CGFloat = 1.0
    @State private var lastOffset: CGSize = .zero
    @State private var selectedInterestId: String? = nil
    private let repo = KnowledgeRepository()

    private var claims: [KnowledgeClaim] { snapshot?.claims ?? [] }
    private var evidenceLinks: [EvidenceLink] { snapshot?.evidenceLinks ?? [] }
    private var papers: [Paper] { snapshot?.papers ?? [] }
    private var notes: [KnowledgeNote] { snapshot?.notes ?? [] }
    private var interests: [ResearchInterest] { snapshot?.interests ?? [] }
    private var experiments: [ExperimentRecord] { snapshot?.experiments ?? [] }
    private var citations: [PaperCitation] { snapshot?.citations ?? [] }

    // MARK: - Filtering

    private var filteredInterests: [ResearchInterest] {
        guard let id = selectedInterestId else { return interests }
        return interests.filter { $0.id == id }
    }

    private var filteredClaims: [KnowledgeClaim] {
        guard let id = selectedInterestId else { return claims }
        return claims.filter { $0.researchInterestId == id }
    }

    private var linkedSourceIds: Set<String> {
        let visibleClaimIds = Set(filteredClaims.map(\.id))
        return Set(evidenceLinks.filter { visibleClaimIds.contains($0.claimId) }.map(\.sourceId))
    }

    private var filteredEvidenceNodes: [GraphNode] {
        let linked = linkedSourceIds
        var nodes: [GraphNode] = []
        if selectedInterestId == nil {
            nodes += papers.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }
            nodes += notes.map { GraphNode(id: $0.id, label: $0.title, type: .note) }
            nodes += experiments.map { GraphNode(id: $0.id, label: $0.title, type: .experiment) }
        } else {
            nodes += papers.filter { linked.contains($0.id) }.map { GraphNode(id: $0.id, label: $0.title, type: .paper) }
            nodes += notes.filter { linked.contains($0.id) }.map { GraphNode(id: $0.id, label: $0.title, type: .note) }
            nodes += experiments.filter { linked.contains($0.id) }.map { GraphNode(id: $0.id, label: $0.title, type: .experiment) }
        }
        return nodes
    }

    private var allVisibleNodes: [GraphNode] {
        filteredInterests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) }
            + filteredClaims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) }
            + filteredEvidenceNodes
    }

    private var filteredEvidenceLinks: [EvidenceLink] {
        guard selectedInterestId != nil else { return evidenceLinks }
        let visibleNodeIds = Set(allVisibleNodes.map(\.id))
        let visibleClaimIds = Set(filteredClaims.map(\.id))
        return evidenceLinks.filter { visibleClaimIds.contains($0.claimId) && visibleNodeIds.contains($0.sourceId) }
    }

    private var filteredCitations: [PaperCitation] {
        guard selectedInterestId != nil else { return citations }
        let visibleNodeIds = Set(allVisibleNodes.map(\.id))
        return citations.filter { visibleNodeIds.contains($0.citingPaperId) && visibleNodeIds.contains($0.citedPaperId) }
    }

    private var timelineEntries: [KnowledgeGraphTimelineEntry] {
        let visibleInterests = selectedInterestId == nil ? interests : interests.filter { $0.id == selectedInterestId }
        let visibleClaims = selectedInterestId == nil ? claims : claims.filter { $0.researchInterestId == selectedInterestId }
        let visiblePapers = selectedInterestId == nil ? papers : papers.filter { linkedSourceIds.contains($0.id) }
        let visibleExperiments = selectedInterestId == nil ? experiments : experiments.filter { linkedSourceIds.contains($0.id) }

        var entries: [KnowledgeGraphTimelineEntry] = []
        for item in visibleInterests {
            let y = Calendar.current.component(.year, from: item.createdAt ?? Date())
            entries.append(KnowledgeGraphTimelineEntry(
                id: "interest:\(item.id)", year: y, date: item.createdAt ?? Date(),
                kind: .interest, title: item.folderName?.isEmpty == false ? item.folderName! : item.topic,
                detail: item.keywords?.prefix(3).joined(separator: " · ") ?? "建立研究方向"
            ))
        }
        for item in visiblePapers {
            let y = item.year ?? Calendar.current.component(.year, from: item.createdAt)
            entries.append(KnowledgeGraphTimelineEntry(
                id: "paper:\(item.id)", year: y, date: item.year != nil ? DateComponents(calendar: .current, year: item.year!).date! : item.createdAt,
                kind: .paper, title: item.title,
                detail: { let s = [item.year.map { "\($0)" }, item.venue].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "); return s.isEmpty ? "论文纳入知识库" : s }()
            ))
        }
        for item in visibleClaims {
            let y = Calendar.current.component(.year, from: item.createdAt ?? Date())
            let statusLabel = KnowledgeClaimStatus.from(item.status)?.displayName ?? item.status ?? ""
            entries.append(KnowledgeGraphTimelineEntry(
                id: "claim:\(item.id)", year: y, date: item.createdAt ?? Date(),
                kind: .claim, title: item.title, detail: statusLabel
            ))
        }
        for item in visibleExperiments {
            let y = Calendar.current.component(.year, from: item.updatedAt ?? item.createdAt ?? Date())
            let detail = item.notes?.isEmpty == false ? item.notes! : "实验推进"
            entries.append(KnowledgeGraphTimelineEntry(
                id: "experiment:\(item.id)", year: y, date: item.updatedAt ?? item.createdAt ?? Date(),
                kind: .experiment, title: item.title, detail: String(detail.prefix(80))
            ))
        }
        return entries.filter { $0.year > 0 }.sorted { $0.date < $1.date }.suffix(24)
    }

    var body: some View {
        HSplitView {
            canvasArea
                .frame(minWidth: 400)

            inspectorPanel
                .frame(minWidth: 260, maxWidth: 360)
        }
        .onAppear(perform: loadData)
        .sheet(item: $pendingEvidencePair, onDismiss: {
            editor.cancelTool()
        }) { pair in
            EvidenceLinkSheet(claim: pair.claim, evidence: pair.evidence) { _ in
                loadData()
            }
        }
        .sheet(item: $pendingCitationPair, onDismiss: {
            editor.cancelTool()
        }) { pair in
            CitationLinkSheet(citing: pair.citing, cited: pair.cited) { _ in
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
                if !interests.isEmpty {
                    Picker("研究方向", selection: $selectedInterestId) {
                        Text("全部").tag(String?.none)
                        ForEach(interests) { interest in
                            Text(interest.topic).tag(Optional(interest.id))
                        }
                    }
                    .pickerStyle(.menu)
                    .controlSize(.small)
                    .frame(width: 160)
                }
                if let summary = snapshot?.summary {
                    HStack(spacing: 10) {
                        MetricTile(label: "研究方向", value: summary.interestCount)
                        MetricTile(label: "结论节点", value: summary.claimCount)
                        MetricTile(label: "证据关系", value: summary.evidenceCount)
                        MetricTile(label: "引用边", value: summary.citationCount)
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

            if allVisibleNodes.isEmpty {
                ContentUnavailableView("暂无可视化关系", systemImage: "network")
            } else {
                HStack(alignment: .top, spacing: 16) {
                    column(title: "研究方向", nodes: filteredInterests.map { GraphNode(id: $0.id, label: $0.topic, type: .interest) })
                    column(title: "论断", nodes: filteredClaims.map { GraphNode(id: $0.id, label: $0.title, type: .claim) })
                    column(title: "证据", nodes: filteredEvidenceNodes)
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .scaleEffect(canvasScale)
                .offset(canvasOffset)
                .overlayPreferenceValue(NodeAnchorKey.self) { anchors in
                    GraphEdgeOverlay(
                        evidenceLinks: filteredEvidenceLinks,
                        citations: filteredCitations,
                        nodeAnchors: anchors
                    )
                }
                .gesture(
                    SimultaneousGesture(
                        MagnificationGesture()
                            .onChanged { value in
                                let delta = value / lastScale
                                lastScale = value
                                canvasScale = min(max(canvasScale * delta, 0.6), 2.2)
                            }
                            .onEnded { _ in
                                lastScale = 1.0
                            },
                        DragGesture()
                            .onChanged { value in
                                canvasOffset = CGSize(
                                    width: lastOffset.width + value.translation.width,
                                    height: lastOffset.height + value.translation.height
                                )
                            }
                            .onEnded { _ in
                                lastOffset = canvasOffset
                            }
                    )
                )
            }

            if let mode = composerMode {
                Divider()
                KnowledgeGraphComposer(
                    initialMode: mode,
                    snapshot: snapshot,
                    onChanged: {
                        loadData()
                    },
                    onClose: {
                        composerMode = nil
                    }
                )
            }

            Divider()
            timelinePanel
        }
    }

    private var timelinePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("研究方向演进时间线")
                    .font(.subheadline.bold())
                Spacer()
            }
            .padding(.horizontal)
            .padding(.top, 12)

            if timelineEntries.isEmpty {
                Text("目前还没有足够事件形成时间线。先导入论文，或补充结论与实验记录。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(groupedTimelineYears, id: \.year) { group in
                            VStack(alignment: .leading, spacing: 8) {
                                Text("\(group.year)")
                                    .font(.title3.bold())
                                    .foregroundStyle(.primary)
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(group.entries) { entry in
                                        timelineCard(entry)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
        .frame(maxHeight: 260)
    }

    private var groupedTimelineYears: [(year: Int, entries: [KnowledgeGraphTimelineEntry])] {
        let dict = Dictionary(grouping: timelineEntries) { $0.year }
        return dict.keys.sorted().map { (year: $0, entries: dict[$0] ?? []) }
    }

    private func timelineCard(_ entry: KnowledgeGraphTimelineEntry) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: entry.icon)
                .font(.caption)
                .foregroundStyle(.blue)
                .frame(width: 24, height: 24)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(6)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.title)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Text(entry.kindLabel)
                        .font(.caption2.weight(.semibold))
                        .textCase(.uppercase)
                        .tracking(0.5)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(4)
                }
                if !entry.detail.isEmpty {
                    Text(entry.detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }
            Spacer()
            Text(entry.date, style: .date)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
        .frame(width: 280)
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
        let isActive = tool == .addClaim
            ? composerMode != nil
            : editor.activeTool == tool
        Button {
            if tool == .addClaim {
                if composerMode != nil {
                    composerMode = nil
                } else {
                    composerMode = .claim
                    editor.cancelTool()
                }
            } else {
                composerMode = nil
                editor.startTool(tool)
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: tool.icon)
                Text(tool.label)
            }
            .font(.caption.weight(isActive ? .semibold : .regular))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(isActive ? Color.accentColor : Color.clear)
            .foregroundStyle(isActive ? Color.white : Color.primary)
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

    private func MetricTile(label: String, value: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .tracking(1.6)
                .textCase(.uppercase)
            Text("\(value)")
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.primary)
                .padding(.top, 8)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(minWidth: 90)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
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
        .anchorPreference(key: NodeAnchorKey.self, value: .bounds) { [node.id: $0] }
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
        switch editor.pickNode(node) {
        case .invalidNode, .sourcePicked:
            break
        case .readyForSheet(let source, let target):
            switch editor.activeTool {
            case .linkEvidence:
                pendingEvidencePair = EvidenceLinkPair(claim: source, evidence: target)
            case .linkCitation:
                pendingCitationPair = CitationLinkPair(citing: source, cited: target)
            default:
                editor.cancelTool()
            }
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

                    KnowledgeClaimPanel(
                        claims: claims,
                        evidenceLinks: evidenceLinks,
                        papers: papers,
                        notes: notes,
                        experiments: experiments,
                        onDeleteClaim: deleteClaim,
                        onUnlinkEvidence: unlinkEvidence,
                        onChanged: loadData
                    )

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

            switch node.type {
            case .claim:
                claimInspector(node)
            case .interest:
                interestInspector(node)
            case .paper:
                paperInspector(node)
            case .experiment:
                experimentInspector(node)
            case .note:
                noteInspector(node)
            }

            HStack(spacing: 16) {
                statItem(label: "出边", value: "\(outgoingLinks(for: node).count)")
                statItem(label: "入边", value: "\(incomingLinks(for: node).count)")
            }
        }
    }

    // MARK: - Type-specific inspectors

    private func claimInspector(_ node: GraphNode) -> some View {
        guard let claim = claims.first(where: { $0.id == node.id }) else { return AnyView(EmptyView()) }
        let claimLinks = evidenceLinks.filter { $0.claimId == claim.id }
        let paperCount = claimLinks.filter { $0.sourceKind == "paper" }.count
        let expCount = claimLinks.filter { $0.sourceKind == "experiment" }.count
        let noteCount = claimLinks.filter { $0.sourceKind == "note" }.count
        return AnyView(VStack(alignment: .leading, spacing: 12) {
            if !claim.statement.isEmpty {
                Text(claim.statement)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(4)
            }
            HStack(spacing: 8) {
                BadgeView(text: "\(paperCount) 篇论文", color: .purple)
                BadgeView(text: "\(expCount) 个实验", color: .red)
                BadgeView(text: "\(noteCount) 条笔记", color: .orange)
            }
            if !claimLinks.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("关联证据")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(claimLinks.prefix(4)) { link in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(alignment: .top, spacing: 4) {
                                Image(systemName: relationIcon(link.relationKind))
                                    .foregroundStyle(relationColor(link.relationKind))
                                    .font(.caption2)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(sourceTitle(for: link) ?? link.sourceId)
                                        .font(.caption.bold())
                                        .lineLimit(2)
                                    Text(sourceKindLabel(link.sourceKind))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
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
        })
    }

    private func interestInspector(_ node: GraphNode) -> some View {
        guard let interest = interests.first(where: { $0.id == node.id }) else { return AnyView(EmptyView()) }
        return AnyView(VStack(alignment: .leading, spacing: 12) {
            if let keywords = interest.keywords, !keywords.isEmpty {
                HStack(spacing: 6) {
                    ForEach(keywords.prefix(6), id: \.self) { kw in
                        Text(kw)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
            if let profile = interest.profile {
                VStack(alignment: .leading, spacing: 6) {
                    if let goal = profile.goal, !goal.isEmpty {
                        HStack(spacing: 4) {
                            Text("目标")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(goal)
                                .font(.caption)
                                .lineLimit(2)
                        }
                    }
                    if let time = profile.timeBudget, !time.isEmpty {
                        HStack(spacing: 4) {
                            Text("时间")
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text(time)
                                .font(.caption)
                        }
                    }
                }
            }
        })
    }

    private func paperInspector(_ node: GraphNode) -> some View {
        guard let paper = papers.first(where: { $0.id == node.id }) else { return AnyView(EmptyView()) }
        let meta = [paper.year.map { "\($0)" }, paper.venue, paper.authors.joined(separator: ", ")].compactMap { $0 }.filter { !$0.isEmpty }
        return AnyView(VStack(alignment: .leading, spacing: 12) {
            if !meta.isEmpty {
                Text(meta.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            let snippet = paper.analysis?.keyConclusions ?? paper.notes
            if let snippet = snippet, !snippet.isEmpty {
                Text(snippet)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(5)
            } else {
                Text("这篇论文已进入图谱，但还没有补充分析或笔记。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        })
    }

    private func experimentInspector(_ node: GraphNode) -> some View {
        guard let exp = experiments.first(where: { $0.id == node.id }) else { return AnyView(EmptyView()) }
        let snippet = exp.notes ?? "实验节点已加入图谱。"
        return AnyView(VStack(alignment: .leading, spacing: 12) {
            Text(snippet)
                .font(.body)
                .foregroundStyle(.secondary)
                .lineLimit(5)
        })
    }

    private func noteInspector(_ node: GraphNode) -> some View {
        guard let note = notes.first(where: { $0.id == node.id }) else { return AnyView(EmptyView()) }
        return AnyView(VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 4) {
                Image(systemName: noteSourceIcon(note.sourceType))
                    .font(.caption)
                Text(noteSourceLabel(note.sourceType))
                    .font(.caption)
            }
            .foregroundStyle(.secondary)
            if !note.content.isEmpty {
                Text(note.content)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .lineLimit(6)
            }
        })
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

    private func sourceTitle(for link: EvidenceLink) -> String? {
        switch link.sourceKind {
        case "paper": return papers.first(where: { $0.id == link.sourceId })?.title
        case "note": return notes.first(where: { $0.id == link.sourceId })?.title
        case "experiment": return experiments.first(where: { $0.id == link.sourceId })?.title
        default: return nil
        }
    }

    private func sourceKindLabel(_ kind: String) -> String {
        switch kind {
        case "paper": return "论文"
        case "note": return "笔记"
        case "experiment": return "实验"
        default: return kind
        }
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

    private func deleteClaim(id: String) {
        try? repo.deleteClaim(id: id)
        if selectedNode?.id == id { selectedNode = nil }
        loadData()
    }

    private func unlinkEvidence(id: String) {
        try? repo.deleteEvidence(id: id)
        loadData()
    }
}

// MARK: - Timeline

struct KnowledgeGraphTimelineEntry: Identifiable {
    let id: String
    let year: Int
    let date: Date
    let kind: Kind
    let title: String
    let detail: String

    enum Kind: String {
        case interest, paper, claim, experiment

        var label: String {
            switch self {
            case .interest: return "方向"
            case .paper: return "论文"
            case .claim: return "结论"
            case .experiment: return "实验"
            }
        }

        var icon: String {
            switch self {
            case .interest: return "flag.fill"
            case .paper: return "book.fill"
            case .claim: return "sparkles"
            case .experiment: return "flask.fill"
            }
        }
    }

    var kindLabel: String { kind.label }
    var icon: String { kind.icon }
}

// MARK: - Sheet routing payloads

struct EvidenceLinkPair: Identifiable {
    let claim: GraphNode
    let evidence: GraphNode
    var id: String { "\(claim.id)::\(evidence.id)" }
}

struct CitationLinkPair: Identifiable {
    let citing: GraphNode
    let cited: GraphNode
    var id: String { "\(citing.id)::\(cited.id)" }
}
