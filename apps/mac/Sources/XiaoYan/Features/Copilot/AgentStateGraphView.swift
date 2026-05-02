import SwiftUI

// MARK: - Layout

private struct AgentGraphLayoutPreset {
    let baseNodeWidth: CGFloat = 188
    let maxNodeWidth: CGFloat = 244
    let nodeHeight: CGFloat = 90
    let horizontalGap: CGFloat = 82
    let verticalGap: CGFloat = 26
    let sidePadding: CGFloat = 34
    let topPadding: CGFloat = 30
    let bottomPadding: CGFloat = 32
    let minCanvasWidth: CGFloat = 860
    let minCanvasHeight: CGFloat = 320
    let maxViewportHeight: CGFloat = 440
}

private struct AgentGraphLayout {
    let canvasWidth: CGFloat
    let canvasHeight: CGFloat
    let viewportHeight: CGFloat
    let nodeWidth: CGFloat
    let nodeHeight: CGFloat
    let positions: [String: CGPoint]
}

private func buildAgentGraphLayout(
    nodes: [(id: String, title: String, goal: String, lane: String, status: AgentStatus)]
) -> AgentGraphLayout {
    let preset = AgentGraphLayoutPreset()
    let workerNodes = nodes.filter { $0.lane == "worker" }
    let hasRetrieval = nodes.contains { $0.id == "retrieval" }
    let hasSynthesis = nodes.contains { $0.id == "synthesis" }
    let longestTitleLength = nodes.reduce(0) { max($0, $1.title.count) }
    let adaptiveNodeWidth = max(
        preset.baseNodeWidth,
        min(preset.maxNodeWidth, preset.baseNodeWidth + CGFloat(max(0, longestTitleLength - 8)) * 6)
    )

    let laneCounts = [1, hasRetrieval ? 1 : 0, workerNodes.count, hasSynthesis ? 1 : 0].filter { $0 > 0 }
    let maxLaneCount = max(laneCounts.max() ?? 1, 1)
    let contentHeight = CGFloat(maxLaneCount) * preset.nodeHeight + CGFloat(maxLaneCount - 1) * preset.verticalGap
    let canvasHeight = max(preset.minCanvasHeight, preset.topPadding + contentHeight + preset.bottomPadding)

    var positions = [String: CGPoint]()
    var currentX = preset.sidePadding + adaptiveNodeWidth / 2

    func laneCenterY(index: Int, laneCount: Int, contentH: CGFloat) -> CGFloat {
        let laneH = CGFloat(laneCount) * preset.nodeHeight + CGFloat(laneCount - 1) * preset.verticalGap
        let laneTop = preset.topPadding + (contentH - laneH) / 2
        return laneTop + preset.nodeHeight / 2 + CGFloat(index) * (preset.nodeHeight + preset.verticalGap)
    }

    positions["start"] = CGPoint(x: currentX, y: laneCenterY(index: 0, laneCount: 1, contentH: contentHeight))

    if hasRetrieval {
        currentX += adaptiveNodeWidth + preset.horizontalGap
        positions["retrieval"] = CGPoint(x: currentX, y: laneCenterY(index: 0, laneCount: 1, contentH: contentHeight))
    }

    if !workerNodes.isEmpty {
        currentX += adaptiveNodeWidth + preset.horizontalGap
        for (index, node) in workerNodes.enumerated() {
            positions[node.id] = CGPoint(
                x: currentX,
                y: laneCenterY(index: index, laneCount: workerNodes.count, contentH: contentHeight)
            )
        }
    }

    if hasSynthesis {
        currentX += adaptiveNodeWidth + preset.horizontalGap
        positions["synthesis"] = CGPoint(x: currentX, y: laneCenterY(index: 0, laneCount: 1, contentH: contentHeight))
    }

    let canvasWidth = max(preset.minCanvasWidth, currentX + adaptiveNodeWidth / 2 + preset.sidePadding)
    let viewportHeight = min(canvasHeight, preset.maxViewportHeight)

    return AgentGraphLayout(
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight,
        viewportHeight: viewportHeight,
        nodeWidth: adaptiveNodeWidth,
        nodeHeight: preset.nodeHeight,
        positions: positions
    )
}

// MARK: - Scroll Wheel Handler

private struct ScrollWheelHandler: NSViewRepresentable {
    var onScroll: (CGFloat) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = ScrollWheelNSView()
        view.onScroll = onScroll
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        (nsView as? ScrollWheelNSView)?.onScroll = onScroll
    }
}

private class ScrollWheelNSView: NSView {
    var onScroll: ((CGFloat) -> Void)?

    override func scrollWheel(with event: NSEvent) {
        onScroll?(event.scrollingDeltaY)
        super.scrollWheel(with: event)
    }
}

// MARK: - View

struct AgentStateGraphView: View {
    let plan: [AgentPlanStep]
    let runs: [AgentRunDisplay]
    let sending: Bool

    @State private var canvasScale: CGFloat = 1.0
    @State private var canvasOffset: CGSize = .zero
    @State private var lastScale: CGFloat = 1.0
    @State private var lastOffset: CGSize = .zero

    private let nodeOrder: [(id: String, title: String, goal: String, lane: String)] = [
        ("start", "接收问题", "建立本轮执行状态、上下文摘要与问题范围", "entry"),
        ("retrieval", "图谱与语义检索", "从知识图谱与语义检索中收集与当前问题直接相关的证据和溯源链", "retrieval"),
        ("planner", "生成研究路径", "围绕用户主题给出系统化学习和研究推进路径", "worker"),
        ("literature_scout", "筛选候选论文", "快速检索和整理该问题对应的核心论文与线索", "worker"),
        ("survey", "组织文献综述", "把检索到的论文整理成结构化领域概览", "worker"),
        ("paper_analyst", "解析当前论文", "提炼研究问题、方法、实验与局限", "worker"),
        ("reproduction", "输出复现建议", "围绕当前论文给出复现链路和风险提示", "worker"),
        ("synthesis", "整合最终回答", "汇总各节点状态并组织为用户可直接使用的答复", "synthesis"),
    ]

    var activeNodes: [(id: String, title: String, goal: String, lane: String, status: AgentStatus)] {
        let runByAgent = Dictionary(grouping: runs, by: { $0.agentName })
            .mapValues { $0.sorted { $0.orderIndex > $1.orderIndex }.first }

        let planByAgent = Dictionary(grouping: plan, by: { $0.agentName })
            .mapValues { $0.first }

        let activeAgentNames = Set(plan.map { $0.agentName } + runs.map { $0.agentName })

        return nodeOrder.compactMap { id, title, goal, lane in
            guard id == "start" || activeAgentNames.contains(id) else { return nil }
            let run = runByAgent[id] ?? nil
            let step = planByAgent[id] ?? nil
            let status: AgentStatus = run?.status ?? (id == "start" ? .done : (sending ? .pending : .idle))
            return (id, step?.title ?? run?.stepName ?? title, step?.goal ?? goal, lane, status)
        }
    }

    var edges: [(from: String, to: String, status: String)] {
        let nodes = activeNodes
        let nodeIds = Set(nodes.map { $0.id })
        var result: [(from: String, to: String, status: String)] = []
        let hasRetrieval = nodeIds.contains("retrieval")
        let workers = nodes.filter { $0.lane == "worker" }.map { $0.id }

        if hasRetrieval {
            result.append(("start", "retrieval", edgeStatus("start", "retrieval")))
        }
        for worker in workers {
            let from = hasRetrieval ? "retrieval" : "start"
            result.append((from, worker, edgeStatus(from, worker)))
        }
        if nodeIds.contains("synthesis") {
            if !workers.isEmpty {
                for worker in workers {
                    result.append((worker, "synthesis", edgeStatus(worker, "synthesis")))
                }
            } else if hasRetrieval {
                result.append(("retrieval", "synthesis", edgeStatus("retrieval", "synthesis")))
            } else {
                result.append(("start", "synthesis", edgeStatus("start", "synthesis")))
            }
        }
        return result.filter { nodeIds.contains($0.from) && nodeIds.contains($0.to) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if activeNodes.isEmpty {
                Text("提交问题后，这里会展示状态图中的节点状态与边流转。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                let layout = buildAgentGraphLayout(nodes: activeNodes)

                canvasContainer(layout: layout)

                if !edges.isEmpty {
                    edgeListSection
                }
            }
        }
        .onChange(of: plan.count) { resetCanvas() }
        .onChange(of: runs.count) { resetCanvas() }
    }

    // MARK: Canvas

    private func canvasContainer(layout: AgentGraphLayout) -> some View {
        GeometryReader { geo in
            ZStack {
                // Background
                RoundedRectangle(cornerRadius: Theme.Radii.large)
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [Color.blue.opacity(0.05), Color.clear]),
                            center: .topLeading,
                            startRadius: 0,
                            endRadius: geo.size.width * 0.3
                        )
                    )
                    .background(
                        LinearGradient(
                            gradient: Gradient(colors: [Color.white.opacity(0.82), Color.white.opacity(0.64)]),
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.Radii.large)
                            .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
                    )

                // Hint label
                Text("拖动画布，滚轮缩放")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.84))
                    .cornerRadius(12)
                    .shadow(color: Color.black.opacity(0.08), radius: 8, x: 0, y: 4)
                    .position(x: layout.canvasWidth - 100, y: 24)

                // Edges
                ForEach(edges, id: \.from) { edge in
                    edgePathView(edge: edge, layout: layout)
                }

                // Pulse indicators on active edges
                ForEach(edges.filter { $0.status == "active" }, id: \.from) { edge in
                    pulseIndicator(edge: edge, layout: layout)
                }

                // Nodes
                ForEach(activeNodes, id: \.id) { node in
                    nodeCard(node: node, layout: layout)
                }
            }
            .frame(width: layout.canvasWidth, height: layout.canvasHeight)
            .scaleEffect(canvasScale)
            .offset(canvasOffset)
        }
        .frame(height: layout.viewportHeight)
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radii.large))
        .overlay(
            ScrollWheelHandler { delta in
                let direction: CGFloat = delta < 0 ? -0.08 : 0.08
                let newScale = canvasScale + direction
                canvasScale = min(max(newScale, 0.72), 1.8)
            }
        )
        .gesture(
            SimultaneousGesture(
                MagnificationGesture()
                    .onChanged { value in
                        let delta = value / lastScale
                        lastScale = value
                        canvasScale = min(max(canvasScale * delta, 0.72), 1.8)
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

    // MARK: Edge Path

    private func edgePathView(edge: (from: String, to: String, status: String), layout: AgentGraphLayout) -> some View {
        guard let source = layout.positions[edge.from],
              let target = layout.positions[edge.to] else { return AnyView(EmptyView()) }

        let tone = edgeTone(edge.status)
        let path = buildEdgePath(from: source, to: target)

        return AnyView(
            ZStack {
                // Shadow path
                path
                    .stroke(Color.black.opacity(0.08), style: StrokeStyle(lineWidth: 7, lineCap: .round))

                // Main path
                path
                    .stroke(tone.stroke, style: StrokeStyle(
                        lineWidth: 3,
                        lineCap: .round,
                        dash: edge.status == "active" ? [8, 8] : []
                    ))
                    .opacity(edge.status == "pending" ? 0.4 : 1)
            }
        )
    }

    private func buildEdgePath(from: CGPoint, to: CGPoint) -> Path {
        var path = Path()
        let curve = max(54, (to.x - from.x) * 0.38)
        path.move(to: from)
        path.addCurve(
            to: to,
            control1: CGPoint(x: from.x + curve, y: from.y),
            control2: CGPoint(x: to.x - curve, y: to.y)
        )
        return path
    }

    // MARK: Pulse Indicator

    private func pulseIndicator(edge: (from: String, to: String, status: String), layout: AgentGraphLayout) -> some View {
        guard let source = layout.positions[edge.from],
              let target = layout.positions[edge.to] else { return AnyView(EmptyView()) }

        let center = CGPoint(x: (source.x + target.x) / 2, y: (source.y + target.y) / 2)

        return AnyView(
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [Color.blue, Color.blue.opacity(0.6)]),
                        center: .center,
                        startRadius: 0,
                        endRadius: 6
                    )
                )
                .frame(width: 12, height: 12)
                .shadow(color: Color.blue.opacity(0.12), radius: 4, x: 0, y: 0)
                .position(center)
                .opacity(pulseOpacity)
                .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: pulseOpacity)
                .onAppear { pulseOpacity = 1.0 }
        )
    }

    @State private var pulseOpacity: CGFloat = 0.5

    // MARK: Node Card

    private func nodeCard(
        node: (id: String, title: String, goal: String, lane: String, status: AgentStatus),
        layout: AgentGraphLayout
    ) -> some View {
        guard let position = layout.positions[node.id] else { return AnyView(EmptyView()) }
        let tone = nodeTone(node.status)

        return AnyView(
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(node.title)
                        .font(.caption.bold())
                        .lineLimit(1)
                    Spacer()
                    Text(tone.label)
                        .font(.system(size: 11, weight: .medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(tone.badgeBackground)
                        .foregroundColor(tone.badgeColor)
                        .cornerRadius(4)
                }

                if !node.goal.isEmpty {
                    Text(node.goal)
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
            }
            .padding(8)
            .frame(width: layout.nodeWidth, alignment: .leading)
            .background(tone.background)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(tone.border, lineWidth: 1)
            )
            .cornerRadius(12)
            .shadow(color: tone.shadowColor.opacity(tone.shadowOpacity), radius: 16, x: 0, y: 8)
            .position(position)
        )
    }

    // MARK: Edge List

    private var edgeListSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("边流转")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Spacer()
                Text(edges.contains { $0.status == "active" } ? "当前有节点在推进" : "等待下一跳")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 6) {
                ForEach(edges.prefix(6), id: \.from) { edge in
                    edgeListRow(edge: edge)
                }
            }
        }
    }

    private func edgeListRow(edge: (from: String, to: String, status: String)) -> some View {
        let fromNode = activeNodes.first { $0.id == edge.from }
        let toNode = activeNodes.first { $0.id == edge.to }
        let tone = edgeTone(edge.status)

        return HStack {
            HStack(spacing: 4) {
                Text(fromNode?.title ?? edge.from)
                    .font(.caption)
                    .lineLimit(1)
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(toNode?.title ?? edge.to)
                    .font(.caption)
                    .lineLimit(1)
            }
            Spacer()
            Text(tone.label)
                .font(.system(size: 11, weight: .medium))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(tone.badgeBackground)
                .foregroundColor(tone.stroke)
                .cornerRadius(4)
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: Helpers

    private func resetCanvas() {
        canvasScale = 1.0
        canvasOffset = .zero
        lastScale = 1.0
        lastOffset = .zero
    }

    private func edgeStatus(_ from: String, _ to: String) -> String {
        guard let source = activeNodes.first(where: { $0.id == from }),
              let target = activeNodes.first(where: { $0.id == to }) else { return "pending" }
        if (source.status == .done || source.status == .failed) && target.status == .running { return "active" }
        if (source.status == .done || source.status == .failed) && target.status == .failed { return "failed" }
        if (source.status == .done || source.status == .failed) && target.status == .done { return "done" }
        return "pending"
    }
}

// MARK: - Tones

private struct NodeTone {
    let label: String
    let background: Color
    let border: Color
    let shadowColor: Color
    let shadowOpacity: CGFloat
    let badgeColor: Color
    let badgeBackground: Color
}

private func nodeTone(_ status: AgentStatus) -> NodeTone {
    switch status {
    case .done:
        return NodeTone(
            label: "完成",
            background: Color.green.opacity(0.08),
            border: Color.green.opacity(0.16),
            shadowColor: Color.green,
            shadowOpacity: 0.10,
            badgeColor: Color(red: 0.086, green: 0.502, blue: 0.208),
            badgeBackground: Color.green.opacity(0.12)
        )
    case .failed:
        return NodeTone(
            label: "失败",
            background: Color.red.opacity(0.08),
            border: Color.red.opacity(0.14),
            shadowColor: Color.red,
            shadowOpacity: 0.08,
            badgeColor: Color(red: 0.725, green: 0.110, blue: 0.110),
            badgeBackground: Color.red.opacity(0.12)
        )
    case .running:
        return NodeTone(
            label: "运行中",
            background: Color.blue.opacity(0.08),
            border: Color.blue.opacity(0.16),
            shadowColor: Color.blue,
            shadowOpacity: 0.12,
            badgeColor: Color(red: 0.114, green: 0.306, blue: 0.847),
            badgeBackground: Color.blue.opacity(0.12)
        )
    case .pending:
        return NodeTone(
            label: "待命",
            background: Color(nsColor: .controlBackgroundColor),
            border: Color.gray.opacity(0.20),
            shadowColor: Color.gray,
            shadowOpacity: 0.08,
            badgeColor: Color(red: 0.278, green: 0.333, blue: 0.412),
            badgeBackground: Color.gray.opacity(0.14)
        )
    case .idle:
        return NodeTone(
            label: "空闲",
            background: Color(nsColor: .controlBackgroundColor).opacity(0.9),
            border: Color.gray.opacity(0.18),
            shadowColor: Color.gray,
            shadowOpacity: 0.06,
            badgeColor: Color(red: 0.392, green: 0.455, blue: 0.545),
            badgeBackground: Color.gray.opacity(0.12)
        )
    }
}

private struct EdgeTone {
    let label: String
    let stroke: Color
    let badgeBackground: Color
}

private func edgeTone(_ status: String) -> EdgeTone {
    switch status {
    case "active":
        return EdgeTone(label: "流转中", stroke: Color(red: 0.145, green: 0.388, blue: 0.922), badgeBackground: Color.blue.opacity(0.12))
    case "failed":
        return EdgeTone(label: "阻塞", stroke: Color(red: 0.863, green: 0.149, blue: 0.149), badgeBackground: Color.red.opacity(0.12))
    case "done":
        return EdgeTone(label: "已流转", stroke: Color(red: 0.086, green: 0.502, blue: 0.208), badgeBackground: Color.green.opacity(0.12))
    default:
        return EdgeTone(label: "未触发", stroke: Color(red: 0.580, green: 0.639, blue: 0.722), badgeBackground: Color.gray.opacity(0.12))
    }
}
