import SwiftUI

struct AgentSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    private let agentOptions: [(key: String, title: String, subtitle: String)] = [
        ("retrieval", "溯源模型", "检索"),
        ("planner", "谋策模型", "路径规划"),
        ("literature_scout", "探知模型", "论文侦察"),
        ("survey", "翰章模型", "综述生成"),
        ("paper_analyst", "洞见模型", "论文解析"),
        ("reproduction", "构域模型", "复现建议"),
        ("synthesis", "整合模型", "最终整合"),
    ]

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

            settingsCard(title: "能力域模型配置", icon: "cpu") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("每个能力域可独立设置模型、地址、密钥和采样参数，留空则继承默认值。")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(agentOptions, id: \.key) { agent in
                        AgentConfigPanel(
                            title: agent.title,
                            subtitle: agent.subtitle,
                            agentKey: agent.key
                        )
                    }
                }
            }
        }
    }
}
