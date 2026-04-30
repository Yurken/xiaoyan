import SwiftUI

struct LayoutSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "侧边栏", icon: "sidebar.left") {
                Toggle("显示图标", isOn: boolBinding(for: "sidebar_show_icons", in: settings))
                Toggle("显示标题", isOn: boolBinding(for: "sidebar_show_titles", in: settings))
                Toggle("紧凑模式", isOn: boolBinding(for: "sidebar_compact", in: settings))
            }

            settingsCard(title: "窗口", icon: "macwindow") {
                Toggle("启动时恢复上次布局", isOn: boolBinding(for: "restore_layout_on_launch", in: settings))
                Toggle("默认全屏", isOn: boolBinding(for: "default_fullscreen", in: settings))
            }

            settingsCard(title: "字体", icon: "textformat") {
                Picker("字号", selection: stringBinding(for: "font_size", in: settings)) {
                    Text("小").tag("small")
                    Text("中").tag("medium")
                    Text("大").tag("large")
                }
            }
        }
    }
}
