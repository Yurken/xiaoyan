import SwiftUI

struct GeneralSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "外观", icon: "paintpalette") {
                Picker("主题", selection: $settings.theme) {
                    ForEach(AppTheme.allCases, id: \.self) { theme in
                        Text(theme.displayName).tag(theme)
                    }
                }
                Picker("风格", selection: $settings.style) {
                    ForEach(AppStyle.allCases, id: \.self) { style in
                        Text(style.displayName).tag(style)
                    }
                }
            }

            settingsCard(title: "记忆", icon: "brain") {
                Toggle("启用长期记忆", isOn: boolBinding(for: "xiaoyan_long_term_memory_enabled", in: settings))
            }
        }
    }
}
