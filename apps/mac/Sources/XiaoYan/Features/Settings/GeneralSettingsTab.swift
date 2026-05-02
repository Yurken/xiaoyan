import SwiftUI

struct GeneralSettingsTab: View {
    @EnvironmentObject var settings: AppSettings
    @EnvironmentObject var colorTokens: AppColorTokens

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "外观", icon: "paintpalette") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("主题")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        ThemeSwatchCard(
                            mode: .system,
                            isSelected: settings.theme == .system,
                            action: { settings.theme = .system; settings.savePreferences() }
                        )
                        ThemeSwatchCard(
                            mode: .light,
                            isSelected: settings.theme == .light,
                            action: { settings.theme = .light; settings.savePreferences() }
                        )
                        ThemeSwatchCard(
                            mode: .dark,
                            isSelected: settings.theme == .dark,
                            action: { settings.theme = .dark; settings.savePreferences() }
                        )
                    }

                    Text("风格")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        StylePreviewCard(
                            style: .modernMinimal,
                            isSelected: settings.style == .modernMinimal,
                            action: { settings.style = .modernMinimal; settings.savePreferences() }
                        )
                        StylePreviewCard(
                            style: .neumorphic,
                            isSelected: settings.style == .neumorphic,
                            action: { settings.style = .neumorphic; settings.savePreferences() }
                        )
                    }
                }
            }

            settingsCard(title: "记忆", icon: "brain") {
                Toggle("启用长期记忆", isOn: boolBinding(for: "xiaoyan_long_term_memory_enabled", in: settings))
            }

            settingsCard(title: "默认参数", icon: "slider.horizontal.3") {
                HStack(spacing: 12) {
                    SettingField(label: "默认温度", key: "default_temperature", settings: settings, placeholder: "0.7")
                    SettingField(label: "最大 Token", key: "default_max_tokens", settings: settings, placeholder: "4096")
                }
            }

            settingsCard(title: "论文处理", icon: "doc.text") {
                HStack(spacing: 12) {
                    SettingField(label: "分块大小", key: "chunk_size", settings: settings, placeholder: "800")
                    SettingField(label: "重叠长度", key: "chunk_overlap", settings: settings, placeholder: "150")
                }
                SettingField(label: "嵌入批次", key: "embedding_batch_size", settings: settings, placeholder: "20")
            }

            settingsCard(title: "任务行为", icon: "gearshape.2") {
                Toggle("自动分析上传论文", isOn: boolBinding(for: "auto_analyze_upload", in: settings))
                Toggle("自动保存对话", isOn: boolBinding(for: "auto_save_chat", in: settings))
            }
        }
    }
}

// MARK: - Theme Swatch

private struct ThemeSwatchCard: View {
    let mode: AppTheme
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    themePreview
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                }
                Text(mode.displayName)
                    .font(.caption.bold())
            }
            .padding(10)
            .background(isSelected ? Color.blue.opacity(0.08) : Theme.Colors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.medium)
                    .stroke(isSelected ? Color.blue.opacity(0.35) : Color.secondary.opacity(0.15), lineWidth: 1)
            )
            .cornerRadius(Theme.Radii.medium)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var themePreview: some View {
        switch mode {
        case .system:
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: "f7f4ee"))
                    .frame(width: 20, height: 28)
                RoundedRectangle(cornerRadius: 6)
                    .fill(Color(hex: "15181d"))
                    .frame(width: 20, height: 28)
            }
            .clipShape(RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
            )
        case .light:
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: "f7f4ee"))
                .frame(width: 40, height: 28)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
                .overlay(
                    Image(systemName: "sun.max.fill")
                        .font(.caption2)
                        .foregroundStyle(Color(hex: "191b1f"))
                )
        case .dark:
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: "15181d"))
                .frame(width: 40, height: 28)
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
                .overlay(
                    Image(systemName: "moon.fill")
                        .font(.caption2)
                        .foregroundStyle(Color(hex: "f3f2ed"))
                )
        }
    }
}

// MARK: - Style Preview

private struct StylePreviewCard: View {
    let style: AppStyle
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    stylePreview
                    Spacer()
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                }
                Text(style.displayName)
                    .font(.caption.bold())
            }
            .padding(10)
            .background(isSelected ? Color.blue.opacity(0.08) : Theme.Colors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.medium)
                    .stroke(isSelected ? Color.blue.opacity(0.35) : Color.secondary.opacity(0.15), lineWidth: 1)
            )
            .cornerRadius(Theme.Radii.medium)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var stylePreview: some View {
        switch style {
        case .modernMinimal:
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: "111317"))
                .frame(width: 48, height: 28)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color(hex: "1a1d23"))
                        .frame(width: 36, height: 18)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
        case .neumorphic:
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(hex: "eef2f5"))
                .frame(width: 48, height: 28)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.white)
                        .frame(width: 36, height: 18)
                        .shadow(color: Color(hex: "788494").opacity(0.18), radius: 3, x: 2, y: 2)
                        .shadow(color: Color.white.opacity(0.85), radius: 3, x: -2, y: -2)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                )
        }
    }
}
