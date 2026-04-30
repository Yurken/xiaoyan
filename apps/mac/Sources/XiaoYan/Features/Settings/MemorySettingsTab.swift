import SwiftUI

struct MemorySettingsTab: View {
    @State private var memories: [UserMemory] = []
    @State private var observations: [MemoryObservation] = []
    @State private var isLoading = true

    private let memoryRepo = MemoryRepository()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "手动备忘", icon: "bookmark") {
                let manual = memories.filter { $0.type == "manual" }
                if manual.isEmpty {
                    Text("暂无手动备忘。前往「小妍」页侧边栏添加。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
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
                            Spacer()
                            Button("清除所有自动记录") {
                                clearAutoMemories()
                            }
                            .font(.caption)
                            .controlSize(.small)
                        }
                        ForEach(auto.prefix(20)) { memory in
                            HStack(alignment: .top, spacing: 8) {
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
                        ForEach(observations.prefix(20)) { obs in
                            VStack(alignment: .leading, spacing: 4) {
                                HStack(spacing: 6) {
                                    Text(obs.source ?? "未知")
                                        .font(.caption2)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.12))
                                        .foregroundColor(.blue)
                                        .cornerRadius(4)
                                    Text(obs.title ?? "")
                                        .font(.caption.bold())
                                    Spacer()
                                    if let date = obs.createdAt {
                                        Text(date, style: .date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                if let summary = obs.summary {
                                    Text(summary)
                                        .font(.caption)
                                }
                                if let narrative = obs.narrative {
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
