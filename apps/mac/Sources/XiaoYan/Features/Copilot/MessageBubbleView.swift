import SwiftUI

struct MessageBubbleView: View {
    let message: ChatDisplayMessage
    var plan: [AgentPlanStep] = []
    var runs: [AgentRunDisplay] = []

    private var parsed: ParsedContent {
        splitThoughtFromContent(message.content)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if message.role == .user { Spacer() }

            VStack(alignment: alignment, spacing: 8) {
                avatarRow
                thinkPlanSection
                contentBubble
                sourcesRow
                streamingIndicator
            }
            .frame(maxWidth: 640, alignment: message.role == .user ? .topTrailing : .topLeading)

            if message.role == .assistant { Spacer() }
        }
    }

    private var alignment: HorizontalAlignment {
        message.role == .user ? .trailing : .leading
    }

    private var avatarRow: some View {
        HStack(spacing: 6) {
            if message.role == .assistant {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Color.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text("小妍")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
            } else {
                Spacer()
                Text("我")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Image(systemName: "person")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Color.accentColor)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    @ViewBuilder
    private var thinkPlanSection: some View {
        if message.role == .assistant,
           (!parsed.thought.isEmpty || !plan.isEmpty || !runs.isEmpty) {
            VStack(alignment: .leading, spacing: 8) {
                if !parsed.thought.isEmpty {
                    DisclosureGroup {
                        Text(parsed.thought)
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .padding(.top, 4)
                    } label: {
                        Text("模型推理过程")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                    }
                    .disclosureGroupStyle(TransparentDisclosureStyle())
                }

                if !plan.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("能力域模型执行步骤")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        ForEach(plan) { step in
                            HStack {
                                Text(step.title)
                                    .font(.caption)
                                Spacer()
                                if let run = runs.first(where: { $0.agentName == step.agentName }) {
                                    RunMiniBadge(status: run.status)
                                } else {
                                    RunMiniBadge(status: .pending)
                                }
                            }
                            .padding(6)
                            .background(Color.white.opacity(0.5))
                            .cornerRadius(6)
                        }
                    }
                }
            }
            .padding(10)
            .background(Color.orange.opacity(0.08))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.orange.opacity(0.15), lineWidth: 1)
            )
        }
    }

    @ViewBuilder
    private var contentBubble: some View {
        if message.role == .user {
            Text(message.content)
                .font(.body)
                .padding(12)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .cornerRadius(18)
        } else {
            if parsed.answer.isEmpty && message.isStreaming {
                Text("小妍正在整理最终答复...")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(18)
            } else if !parsed.answer.isEmpty {
                MarkdownText(content: parsed.answer)
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(18)
            }
        }
    }

    @ViewBuilder
    private var sourcesRow: some View {
        if message.role == .assistant, !message.sources.isEmpty {
            HStack(spacing: 6) {
                ForEach(message.sources.prefix(4)) { source in
                    Text(source.title)
                        .font(.caption2)
                        .lineLimit(1)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(12)
                }
            }
        }
    }

    @ViewBuilder
    private var streamingIndicator: some View {
        if message.isStreaming && message.role == .assistant {
            HStack(spacing: 4) {
                ProgressView()
                    .controlSize(.small)
                Text("生成中...")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Think Parsing

    private struct ParsedContent {
        let thought: String
        let answer: String
    }

    private func splitThoughtFromContent(_ content: String) -> ParsedContent {
        let pattern = "<think>([\\s\\S]*?)</think>"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else {
            return ParsedContent(thought: "", answer: content)
        }
        let range = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, options: [], range: range)
        var thoughts: [String] = []
        var mutableContent = content
        for match in matches.reversed() {
            if let thoughtRange = Range(match.range(at: 1), in: content) {
                thoughts.insert(String(content[thoughtRange]).trimmingCharacters(in: .whitespacesAndNewlines), at: 0)
            }
            if let fullRange = Range(match.range, in: content) {
                mutableContent.removeSubrange(fullRange)
            }
        }
        return ParsedContent(thought: thoughts.joined(separator: "\n\n"), answer: mutableContent.trimmingCharacters(in: .whitespacesAndNewlines))
    }
}

// MARK: - Mini Badge

private struct RunMiniBadge: View {
    let status: AgentStatus

    var body: some View {
        Text(statusLabel)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(statusColor.opacity(0.15))
            .foregroundColor(statusColor)
            .cornerRadius(4)
    }

    private var statusLabel: String {
        switch status {
        case .done: return "已完成"
        case .failed: return "失败"
        case .running: return "处理中"
        case .pending: return "待处理"
        }
    }

    private var statusColor: Color {
        switch status {
        case .done: return .green
        case .failed: return .red
        case .running: return .orange
        case .pending: return .secondary
        }
    }
}

// MARK: - Disclosure Style

struct TransparentDisclosureStyle: DisclosureGroupStyle {
    func makeBody(configuration: Configuration) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { configuration.isExpanded.toggle() }) {
                HStack {
                    configuration.label
                    Spacer()
                    Image(systemName: configuration.isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            if configuration.isExpanded {
                configuration.content
            }
        }
    }
}
