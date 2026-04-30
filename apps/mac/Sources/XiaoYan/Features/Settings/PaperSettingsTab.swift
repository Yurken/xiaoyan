import SwiftUI

struct PaperSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "导入识别", icon: "text.viewfinder") {
                Toggle("自动识别标题", isOn: boolBinding(for: "paper_import_recognize_title", in: settings))
                Toggle("自动识别作者", isOn: boolBinding(for: "paper_import_recognize_authors", in: settings))
                Toggle("自动识别年份", isOn: boolBinding(for: "paper_import_recognize_year", in: settings))
                Toggle("自动识别会议/期刊", isOn: boolBinding(for: "paper_import_recognize_venue", in: settings))
                Toggle("自动识别关键词", isOn: boolBinding(for: "paper_import_recognize_keywords", in: settings))
            }

            settingsCard(title: "重命名规则", icon: "textformat") {
                Toggle("导入时自动重命名文件", isOn: boolBinding(for: "paper_auto_rename_on_import", in: settings))
                SettingField(label: "命名规则", key: "paper_auto_rename_rule", settings: settings, placeholder: "{first_author} - {title} ({year})")
            }
        }
    }
}
