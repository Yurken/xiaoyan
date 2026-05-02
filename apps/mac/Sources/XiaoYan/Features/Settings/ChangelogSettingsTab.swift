import SwiftUI

struct ChangelogSettingsTab: View {
    @State private var versions: [ChangelogVersion] = []
    @State private var selectedVersion: String = ""
    @State private var loadError: String?

    private var selectedLog: ChangelogVersion? {
        versions.first { $0.version == selectedVersion }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let error = loadError {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                .padding(10)
                .background(Color.red.opacity(0.08))
                .cornerRadius(Theme.Radii.medium)
            }

            if !versions.isEmpty {
                Picker("版本", selection: $selectedVersion) {
                    ForEach(versions) { log in
                        Text("v\(log.version) — \(log.date)").tag(log.version)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)
            }

            if let log = selectedLog {
                settingsCard(title: "v\(log.version) — \(log.date)", icon: "tag") {
                    VStack(alignment: .leading, spacing: 16) {
                        ForEach(log.sections) { section in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(section.title)
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.secondary.opacity(0.1))
                                    .cornerRadius(4)
                                ForEach(section.items, id: \.self) { item in
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
            } else {
                Text("暂无版本记录")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        versions = ChangelogParser.loadFromDisk()
        if versions.isEmpty {
            loadError = "未能加载 CHANGELOG.md，请检查文件路径"
            // Fallback to hardcoded minimal data
            versions = [
                ChangelogVersion(
                    version: "0.2.0",
                    date: "2026-04-30",
                    sections: [
                        ChangelogSection(title: "新增", items: [
                            "新增原生 macOS 客户端",
                            "支持论文上传、解析、精读分析与复现指导",
                        ])
                    ]
                )
            ]
        }
        if let first = versions.first, selectedVersion.isEmpty {
            selectedVersion = first.version
        }
    }
}
