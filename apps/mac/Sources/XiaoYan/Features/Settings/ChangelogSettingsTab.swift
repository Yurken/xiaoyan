import SwiftUI

struct ChangelogSettingsTab: View {
    private let changelogs: [(version: String, date: String, items: [String])] = [
        (
            version: "0.2.0",
            date: "2026-04-30",
            items: [
                "新增原生 macOS 客户端",
                "支持论文上传、解析、精读分析与复现指导",
                "集成多 Agent 对话系统",
                "支持知识图谱与实验记录",
                "支持投稿管理与审稿回复",
            ]
        ),
        (
            version: "0.1.0",
            date: "2026-04-01",
            items: [
                "项目初始化",
                "基础架构搭建",
            ]
        ),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            ForEach(changelogs, id: \.version) { log in
                settingsCard(title: "v\(log.version) — \(log.date)", icon: "tag") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(log.items, id: \.self) { item in
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                Text(item)
                                    .font(.body)
                                Spacer()
                            }
                        }
                    }
                }
            }
        }
    }
}
