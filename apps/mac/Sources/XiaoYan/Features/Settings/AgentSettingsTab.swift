import SwiftUI

struct AgentSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "全局开关", icon: "switch.2") {
                Toggle("启用多 Agent 模式", isOn: boolBinding(for: "multi_agent_enabled", in: settings))

                Picker("路由模式", selection: stringBinding(for: "multi_agent_routing_mode", in: settings)) {
                    Text("规则").tag("rule")
                    Text("模型").tag("llm")
                    Text("混合").tag("hybrid")
                }
            }

            settingsCard(title: "调度限制", icon: "gauge.with.dots.needle.67percent") {
                HStack(spacing: 12) {
                    SettingField(label: "最大步数", key: "multi_agent_max_steps", settings: settings, placeholder: "4")
                    SettingField(label: "检索上限", key: "multi_agent_search_limit", settings: settings, placeholder: "8")
                }
            }

            settingsCard(title: "角色任务卡", icon: "person.2.crop.square.stack") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("每张卡对应一组语义相近的字段，填写「统一模型 / 温度 / 接口 / 密钥」将同步覆盖卡内所有 key；留空则各自独立沿用主服务商。")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 320), spacing: 12)],
                        spacing: 12
                    ) {
                        ForEach(ROLE_CARD_PRESETS) { preset in
                            RoleCardView(preset: preset)
                        }
                    }
                }
            }
        }
    }
}
