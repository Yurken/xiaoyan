import SwiftUI

struct AboutSettingsTab: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "应用信息", icon: "info.circle") {
                HStack(spacing: 16) {
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 48))
                        .foregroundStyle(.blue)

                    VStack(alignment: .leading, spacing: 4) {
                        Text("小妍")
                            .font(.title2.bold())
                        Text("科研智能助手")
                            .foregroundStyle(.secondary)
                        Text("版本 \(UpdatesService.currentVersion)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            settingsCard(title: "更新", icon: "arrow.up.circle") {
                HStack {
                    Text("当前版本")
                    Spacer()
                    Text(UpdatesService.currentVersion)
                        .foregroundStyle(.secondary)
                }
            }

            settingsCard(title: "致谢", icon: "heart") {
                Text("感谢所有贡献者与开源社区的支持。")
                    .foregroundStyle(.secondary)
            }
        }
    }
}
