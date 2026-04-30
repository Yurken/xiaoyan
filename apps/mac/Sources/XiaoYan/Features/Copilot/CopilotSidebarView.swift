import SwiftUI

struct CopilotSidebarView: View {
    let activeAgents: [AgentGraphService.AgentNodeState]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Agent 执行图")
                .font(.headline)
                .padding(.horizontal)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if activeAgents.isEmpty {
                        Text("等待任务...")
                            .foregroundStyle(.secondary)
                            .padding(.horizontal)
                    } else {
                        ForEach(activeAgents) { agent in
                            agentRow(agent)
                        }
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding(.top)
    }

    private func agentRow(_ agent: AgentGraphService.AgentNodeState) -> some View {
        HStack(spacing: 8) {
            statusIcon(agent.status)
            VStack(alignment: .leading, spacing: 2) {
                Text(agent.agentName)
                    .font(.subheadline.bold())
                Text(agent.stepName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let summary = agent.summary {
                    Text(summary)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(2)
                }
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
    }

    private func statusIcon(_ status: AgentStatus) -> some View {
        Group {
            switch status {
            case .pending:
                Image(systemName: "clock")
                    .foregroundStyle(.secondary)
            case .running:
                ProgressView()
                    .controlSize(.small)
            case .done:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.red)
            case .idle:
                Image(systemName: "circle")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 16, height: 16)
    }
}
