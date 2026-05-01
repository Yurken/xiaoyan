import SwiftUI

struct AgentConfigPanel: View {
    @EnvironmentObject var settings: AppSettings
    let title: String
    let subtitle: String
    let agentKey: String
    @State private var isExpanded = false

    private var hasValue: Bool {
        ["model", "base_url", "api_key", "temperature", "top_p", "max_tokens"]
            .compactMap { suffixKey($0) }
            .contains { key in
                let val = settings.get(key) ?? ""
                return !val.isEmpty
            }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { isExpanded.toggle() }) {
                HStack(spacing: 6) {
                    Text(title)
                        .font(.subheadline.bold())
                    if hasValue {
                        Circle()
                            .fill(Color.accentColor)
                            .frame(width: 6, height: 6)
                    }
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.vertical, 8)

            if isExpanded {
                Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
                    GridRow {
                        SettingField(label: "Model", key: suffixKey("model")!, settings: settings, placeholder: "留空继承默认")
                        SecureSettingField(label: "API Key", key: suffixKey("api_key")!, settings: settings, placeholder: "留空继承默认")
                    }
                    GridRow {
                        SettingField(label: "Base URL", key: suffixKey("base_url")!, settings: settings, placeholder: "留空继承默认")
                        SettingField(label: "Temperature", key: suffixKey("temperature")!, settings: settings, placeholder: "留空继承默认")
                    }
                    GridRow {
                        SettingField(label: "Top P", key: suffixKey("top_p")!, settings: settings, placeholder: "留空则不设置")
                        SettingField(label: "Max Tokens", key: suffixKey("max_tokens")!, settings: settings, placeholder: "留空则不设置")
                    }
                }
                .padding(.bottom, 8)
            }
        }
        .padding(.horizontal, 12)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    private func suffixKey(_ suffix: String) -> String? {
        "multi_agent_\(agentKey)_\(suffix)"
    }
}
