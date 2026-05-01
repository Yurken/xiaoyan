import SwiftUI

struct MissionControlView: View {
    let plan: [AgentPlanStep]
    let runs: [AgentRunDisplay]
    let artifacts: [AgentArtifact]
    let requestId: String?
    let sending: Bool
    var onSaveMemory: ((String) -> Void)? = nil
    @State private var memoryText = ""
    @State private var memorySaved = false
    @State private var viewMode: ViewMode = .list

    enum ViewMode: String, CaseIterable {
        case list = "列表"
        case graph = "状态图"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("执行总览")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text("调度视图")
                        .font(.headline)
                }
                Spacer()
                Picker("视图", selection: $viewMode) {
                    ForEach(ViewMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 140)
                TagBadge(text: sending ? "处理中" : "就绪", color: sending ? .orange : .green)
            }
            .padding(.horizontal)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let reqId = requestId {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("请求 ID")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(reqId)
                                .font(.system(.caption, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }

                    switch viewMode {
                    case .list:
                        planSection
                        runsSection
                    case .graph:
                        AgentStateGraphView(plan: plan, runs: runs, sending: sending)
                    }

                    artifactsSection
                    memorySection
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .padding(.top)
    }

    private var memorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "brain")
                    .font(.caption)
                    .foregroundStyle(.green)
                Text("添加记忆")
                    .font(.subheadline.bold())
            }

            VStack(alignment: .leading, spacing: 6) {
                TextEditor(text: $memoryText)
                    .font(.caption)
                    .frame(minHeight: 60)
                    .padding(4)
                    .background(Theme.Colors.surface)
                    .cornerRadius(Theme.Radii.medium)
                    .nmShadow(level: Theme.Shadows.soft)

                HStack {
                    if memorySaved {
                        Text("已保存")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                    Spacer()
                    Button("保存") {
                        onSaveMemory?(memoryText)
                        memorySaved = true
                        memoryText = ""
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            memorySaved = false
                        }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .disabled(memoryText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private var planSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "radar")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("计划分解")
                    .font(.subheadline.bold())
            }

            if plan.isEmpty {
                Text("发送问题后，小妍会在此展示任务拆解和执行链路。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(plan) { step in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(step.title)
                                    .font(.caption.bold())
                                Spacer()
                                Text(capabilityName(step.agentName))
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.1))
                                    .cornerRadius(4)
                            }
                            Text(step.goal)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(8)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                }
            }
        }
    }

    private var runsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.orange)
                Text("能力域模型执行")
                    .font(.subheadline.bold())
            }

            if runs.isEmpty {
                Text("暂无分析模型运行记录。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(runs.sorted(by: { $0.orderIndex < $1.orderIndex })) { run in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(run.stepName)
                                        .font(.caption.bold())
                                    Text(capabilityName(run.agentName))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                RunStatusBadge(status: run.status)
                            }
                            if let summary = run.summary {
                                Text(summary)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            if let error = run.error {
                                Text(error)
                                    .font(.caption2)
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(8)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                }
            }
        }
    }

    private var artifactsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(.purple)
                Text("结构化产物")
                    .font(.subheadline.bold())
            }

            if artifacts.isEmpty {
                Text("暂无结构化产物，模型产出后将出现在这里。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(artifacts.prefix(4)) { artifact in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(artifact.title ?? artifact.artifactType)
                                .font(.caption.bold())
                            if let content = artifact.content {
                                Text(content)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(5)
                            }
                        }
                        .padding(8)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                }
            }
        }
    }

    private func capabilityName(_ raw: String) -> String {
        switch raw {
        case "retrieval": return "检索模型"
        case "planner": return "谋策模型"
        case "literature_scout": return "探知模型"
        case "survey": return "翰章模型"
        case "paper_analyst": return "洞见模型"
        case "reproduction": return "构域模型"
        case "synthesis": return "整合模型"
        default: return raw
        }
    }
}

struct RunStatusBadge: View {
    let status: AgentStatus

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: statusIcon)
                .font(.caption2)
            Text(statusLabel)
                .font(.caption2.bold())
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(statusColor.opacity(0.15))
        .foregroundColor(statusColor)
        .cornerRadius(4)
    }

    private var statusIcon: String {
        switch status {
        case .done: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .running: return "clock.fill"
        case .pending: return "clock"
        case .idle: return "circle"
        }
    }

    private var statusLabel: String {
        switch status {
        case .done: return "已完成"
        case .failed: return "失败"
        case .running: return "处理中"
        case .pending: return "待处理"
        case .idle: return "未开始"
        }
    }

    private var statusColor: Color {
        switch status {
        case .done: return .green
        case .failed: return .red
        case .running: return .orange
        case .pending: return .secondary
        case .idle: return .gray
        }
    }
}

struct TagBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }
}
