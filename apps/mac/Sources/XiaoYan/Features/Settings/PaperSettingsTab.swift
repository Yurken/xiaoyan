import SwiftUI

struct PaperSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    private let tagOptions: [(key: String, label: String, description: String)] = [
        ("ccf_rating", "CCF", "显示 CCF 等级标签"),
        ("ccf_type", "期刊/会议", "显示 CCF 识别出的来源类型"),
        ("wos_indexes", "WoS 收录", "显示 SCIE / SSCI / ESCI / AHCI 标签"),
        ("jcr_quartile", "JCR 分区", "显示 JCR Q1-Q4 标签"),
        ("cas_quartile", "中科院分区", "显示中科院 1-4 区标签"),
        ("cas_top", "Top", "显示中科院 Top 标签"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "导入识别", icon: "text.viewfinder") {
                Toggle("自动识别标题", isOn: boolBinding(for: "paper_import_recognize_title", in: settings))
                Toggle("自动识别作者", isOn: boolBinding(for: "paper_import_recognize_authors", in: settings))
                Toggle("自动识别年份", isOn: boolBinding(for: "paper_import_recognize_year", in: settings))
                Toggle("自动识别会议/期刊", isOn: boolBinding(for: "paper_import_recognize_venue", in: settings))
                Toggle("自动识别关键词", isOn: boolBinding(for: "paper_import_recognize_keywords", in: settings))
            }

            settingsCard(title: "论文标签显示", icon: "tag") {
                Text("选择在论文卡片和详情页中展示哪些来源标签。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(tagOptions, id: \.key) { option in
                        Toggle(isOn: Binding(
                            get: { isTagVisible(option.key) },
                            set: { toggleTag(option.key, visible: $0) }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(option.label)
                                    .font(.body)
                                Text(option.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            settingsCard(title: "重命名规则", icon: "textformat") {
                Toggle("导入时自动重命名文件", isOn: boolBinding(for: "paper_auto_rename_on_import", in: settings))
                SettingField(label: "命名规则", key: "paper_auto_rename_rule", settings: settings, placeholder: "{first_author} - {title} ({year})")
            }
        }
    }

    private func isTagVisible(_ key: String) -> Bool {
        let raw = settings.get("paper_visible_venue_tags") ?? ""
        let keys = raw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        return keys.contains(key)
    }

    private func toggleTag(_ key: String, visible: Bool) {
        var keys = (settings.get("paper_visible_venue_tags") ?? "")
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        if visible {
            if !keys.contains(key) {
                keys.append(key)
            }
        } else {
            keys.removeAll { $0 == key }
        }

        let defaultOrder = tagOptions.map { $0.key }
        let ordered = defaultOrder.filter { keys.contains($0) }
        settings.set("paper_visible_venue_tags", ordered.joined(separator: ","))
    }
}
