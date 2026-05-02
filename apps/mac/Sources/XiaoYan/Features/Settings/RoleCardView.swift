import SwiftUI

/// 单张角色任务卡。镜像 desktop `GroupedModelCard`（shared.tsx:245-362）。
/// - 顶部"统一模型 + 统一温度（或副字段）"两个输入
/// - 折叠"展开独立接口配置"按钮 → 显示统一 base_url + 统一 api_key（SecureField 形态）
/// - 多 key 联动：填值时所有同组 key 同步覆盖；组内非空值不一致时显示空 + 琥珀提示
struct RoleCardView: View {
    @EnvironmentObject var settings: AppSettings
    let preset: RoleCardPreset
    @State private var showAdvanced = false
    @State private var apiKeyText = ""
    @State private var apiKeyVisible = false

    private var modelValue: String { sharedValue(preset.modelKeys, in: settings) }
    private var temperatureValue: String { sharedValue(preset.temperatureKeys, in: settings) }
    private var baseUrlValue: String { sharedValue(preset.baseUrlKeys, in: settings) }

    private var modelMixed: Bool { hasMixed(preset.modelKeys, in: settings) }
    private var temperatureMixed: Bool { hasMixed(preset.temperatureKeys, in: settings) }
    private var baseUrlMixed: Bool { hasMixed(preset.baseUrlKeys, in: settings) }
    private var apiKeyMixed: Bool { hasMixed(preset.apiKeyKeys, in: settings) }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text(preset.label).font(.subheadline.bold())
                Text(preset.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Text(preset.recommendation)
                    .font(.caption2)
                    .foregroundStyle(.secondary.opacity(0.8))
            }

            // Top: model + temperature/secondary
            VStack(alignment: .leading, spacing: 6) {
                modelField
                if let sec = preset.secondary {
                    secondaryFieldView(sec)
                } else if !preset.temperatureKeys.isEmpty {
                    temperatureField
                }
            }

            // Advanced toggle
            Button {
                withAnimation(.easeInOut(duration: 0.15)) { showAdvanced.toggle() }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: showAdvanced ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                    Text(showAdvanced ? "收起独立接口配置" : "展开独立接口配置")
                        .font(.caption)
                }
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)

            if showAdvanced {
                VStack(alignment: .leading, spacing: 6) {
                    baseUrlField
                    apiKeyField
                }
            }
        }
        .padding(12)
        .background(Theme.Colors.surface)
        .overlay(
            RoundedRectangle(cornerRadius: Theme.Radii.medium)
                .stroke(Color.gray.opacity(0.18), lineWidth: 1)
        )
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Fields

    private var modelField: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text("统一模型")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 76, alignment: .leading)
                TextField(
                    modelMixed ? "已有不同值，重新填写将统一覆盖" : "留空沿用主服务商",
                    text: Binding(
                        get: { modelValue },
                        set: { setMany(preset.modelKeys, value: $0, in: settings) }
                    )
                )
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            }
            if modelMixed {
                mixedHint
            }
        }
    }

    private var temperatureField: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text("统一温度")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 76, alignment: .leading)
                TextField(
                    temperatureMixed ? "已有不同值" : "留空沿用各自温度",
                    text: Binding(
                        get: { temperatureValue },
                        set: { setMany(preset.temperatureKeys, value: $0, in: settings) }
                    )
                )
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            }
            if temperatureMixed {
                mixedHint
            }
        }
    }

    private func secondaryFieldView(_ sec: SecondaryField) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(sec.label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 76, alignment: .leading)
            TextField(
                sec.placeholder,
                text: Binding(
                    get: { settings.get(sec.key) ?? "" },
                    set: { settings.set(sec.key, $0) }
                )
            )
            .textFieldStyle(.roundedBorder)
            .font(.caption)
        }
    }

    private var baseUrlField: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text("Base URL")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 76, alignment: .leading)
                TextField(
                    baseUrlMixed ? "已有不同接口，重新填写将覆盖" : "留空继承主服务商",
                    text: Binding(
                        get: { baseUrlValue },
                        set: { setMany(preset.baseUrlKeys, value: $0, in: settings) }
                    )
                )
                .textFieldStyle(.roundedBorder)
                .font(.caption)
            }
            if baseUrlMixed {
                mixedHint
            }
        }
    }

    private var apiKeyField: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline) {
                Text("API Key")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(width: 76, alignment: .leading)
                Group {
                    if apiKeyVisible {
                        TextField(
                            apiKeyMixed ? "已有不同密钥，重新填写将覆盖" : "留空继承主服务商",
                            text: $apiKeyText
                        )
                    } else {
                        SecureField(
                            apiKeyMixed ? "已有不同密钥，重新填写将覆盖" : "留空继承主服务商",
                            text: $apiKeyText
                        )
                    }
                }
                .textFieldStyle(.roundedBorder)
                .font(.caption)
                .onAppear { apiKeyText = sharedValue(preset.apiKeyKeys, in: settings) }
                .onChange(of: apiKeyText) { _, newValue in
                    setMany(preset.apiKeyKeys, value: newValue, in: settings)
                }

                Button {
                    apiKeyVisible.toggle()
                } label: {
                    Image(systemName: apiKeyVisible ? "eye.slash" : "eye")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
            if apiKeyMixed {
                mixedHint
            }
        }
    }

    private var mixedHint: some View {
        Text("已有不同值，重新填写将统一覆盖")
            .font(.caption2)
            .foregroundStyle(Color.orange)
            .padding(.leading, 80)
    }
}
