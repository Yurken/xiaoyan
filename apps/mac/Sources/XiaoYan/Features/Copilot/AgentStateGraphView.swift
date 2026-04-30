import SwiftUI

struct AgentStateGraphView: View {
    let plan: [AgentPlanStep]
    let runs: [AgentRunDisplay]
    let sending: Bool

    private let nodeOrder = [
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
                // Nodes grid by lane
                HStack(alignment: .top, spacing: 12) {
                    laneColumn(title: "入口", nodes: activeNodes.filter { $0.lane == "entry" })
                    laneColumn(title: "检索", nodes: activeNodes.filter { $0.lane == "retrieval" })
                    laneColumn(title: "工作", nodes: activeNodes.filter { $0.lane == "worker" })
                    laneColumn(title: "整合", nodes: activeNodes.filter { $0.lane == "synthesis" })
                }

                // Edges
                if !edges.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("边流转")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        ForEach(edges.prefix(6), id: \.from) { edge in
                            edgeRow(edge)
                        }
                    }
                }
            }
        }
    }

    private func laneColumn(title: String, nodes: [(id: String, title: String, goal: String, lane: String, status: AgentStatus)]) -> some View {
        VStack(spacing: 8) {
            Text(title)
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            ForEach(nodes, id: \.id) { node in
                nodeCard(node)
            }
        }
        .frame(minWidth: 80)
    }

    private func nodeCard(_ node: (id: String, title: String, goal: String, lane: String, status: AgentStatus)) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(node.title)
                    .font(.caption.bold())
                    .lineLimit(1)
                Spacer()
                RunStatusBadge(status: node.status)
            }
            Text(node.goal)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground(node.status))
        .cornerRadius(8)
    }

    private func edgeRow(_ edge: (from: String, to: String, status: String)) -> some View {
        HStack {
            HStack(spacing: 4) {
                let fromNode = activeNodes.first { $0.id == edge.from }
                let toNode = activeNodes.first { $0.id == edge.to }
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
            edgeStatusBadge(edge.status)
        }
        .padding(8)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }

    private func edgeStatusBadge(_ status: String) -> some View {
        let color: Color
        let label: String
        switch status {
        case "active": color = .blue; label = "流转中"
        case "done": color = .green; label = "已流转"
        case "failed": color = .red; label = "阻塞"
        default: color = .secondary; label = "未触发"
        }
        return Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(4)
    }

    private func cardBackground(_ status: AgentStatus) -> Color {
        switch status {
        case .done: return Color.green.opacity(0.08)
        case .failed: return Color.red.opacity(0.08)
        case .running: return Color.blue.opacity(0.08)
        case .pending: return Color.orange.opacity(0.06)
        case .idle: return Color(nsColor: .controlBackgroundColor)
        }
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
