import SwiftUI

struct MemorySettingsTab: View {
    @State private var memories: [UserMemory] = []
    @State private var observations: [MemoryObservation] = []
    @State private var isLoading = true

    private let memoryRepo = MemoryRepository()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if isLoading {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("加载记忆中…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
            }

            settingsCard(title: "手动备忘", icon: "bookmark") {
                let manual = memories.filter { $0.type == "manual" }
                if manual.isEmpty {
                    Text("暂无手动备忘。前往「小妍」页侧边栏添加。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Spacer()
                            Text("\(manual.count) 条")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        ForEach(manual) { memory in
                            HStack(alignment: .top, spacing: 8) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(memory.summary)
                                        .font(.caption)
                                    if let date = memory.createdAt {
                                        Text(date, style: .date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Button(action: { deleteMemory(memory) }) {
                                    Image(systemName: "trash")
                                        .font(.caption)
                                        .foregroundStyle(.red)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(8)
                            .background(Color.blue.opacity(0.06))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.blue.opacity(0.15), lineWidth: 1)
                            )
                        }
                    }
                }
            }

            settingsCard(title: "自动操作记录", icon: "clock.arrow.circlepath") {
                let auto = memories.filter { $0.type == "auto" }
                if auto.isEmpty {
                    Text("暂无自动记录。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("系统自动记录的操作轨迹；启用长期记忆时，最近3小时逐条、近7天按天聚合后注入对话。最多保留1000条。")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                            Spacer()
                            Button("清除所有自动记录") {
                                clearAutoMemories()
                            }
                            .font(.caption)
                            .controlSize(.small)
                        }
                        ForEach(auto) { memory in
                            HStack(alignment: .top, spacing: 8) {
                                if let source = memory.action, !source.isEmpty {
                                    Text(formatSource(source))
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.orange.opacity(0.1))
                                        .foregroundStyle(.orange)
                                        .cornerRadius(4)
                                }
                                Text(memory.summary)
                                    .font(.caption)
                                Spacer()
                                if let date = memory.createdAt {
                                    Text(date, style: .date)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Button(action: { deleteMemory(memory) }) {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(6)
                            .background(Color.gray.opacity(0.06))
                            .cornerRadius(6)
                        }
                    }
                }
            }

            settingsCard(title: "长期记忆观察", icon: "eye") {
                if observations.isEmpty {
                    Text("暂无长期记忆观察。先和小妍对话几轮后，这里会开始出现过程记录。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(observations) { obs in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 6) {
                                    if let source = obs.source, !source.isEmpty {
                                        Text(formatSource(source))
                                            .font(.caption2)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(Color.blue.opacity(0.12))
                                            .foregroundColor(.blue)
                                            .cornerRadius(4)
                                    }
                                    if let title = obs.title, !title.isEmpty {
                                        Text(title)
                                            .font(.caption.bold())
                                    }
                                    Spacer()
                                    importanceBadge(obs.importance)
                                    if let date = obs.createdAt {
                                        Text(date, style: .date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                if let summary = obs.summary, !summary.isEmpty {
                                    Text(summary)
                                        .font(.caption)
                                }
                                if let narrative = obs.narrative, !narrative.isEmpty {
                                    Text(narrative)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding(10)
                            .background(Color.blue.opacity(0.05))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.blue.opacity(0.12), lineWidth: 1)
                            )
                        }
                    }
                }
            }
        }
        .onAppear(perform: load)
    }

    // MARK: - Helpers

    private func formatSource(_ source: String) -> String {
        switch source {
        case "chat": return "聊天"
        case "agent": return "能力域模型"
        case "knowledge_note", "knowledge": return "知识笔记"
        case "paper": return "论文"
        case "survey": return "综述"
        default: return source
        }
    }

    private func importanceBadge(_ importance: Int) -> some View {
        let (text, color) = importanceLabel(importance)
        return Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12))
            .foregroundColor(color)
            .cornerRadius(4)
    }

    private func importanceLabel(_ importance: Int) -> (String, Color) {
        if importance >= 3 { return ("高相关", .red) }
        if importance >= 2 { return ("常规", .orange) }
        return ("记录", .secondary)
    }

    // MARK: - Data

    private func load() {
        isLoading = true
        memories = (try? memoryRepo.listMemories()) ?? []
        observations = (try? memoryRepo.recentObservations(hours: 72 * 30, limit: 100)) ?? []
        isLoading = false
    }

    private func deleteMemory(_ memory: UserMemory) {
        try? memoryRepo.deleteMemory(id: memory.id)
        load()
    }

    private func clearAutoMemories() {
        let auto = memories.filter { $0.type == "auto" }
        for memory in auto {
            try? memoryRepo.deleteMemory(id: memory.id)
        }
        load()
    }
}
