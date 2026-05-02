import SwiftUI

struct LayoutSettingsTab: View {
    @EnvironmentObject var settings: AppSettings

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            settingsCard(title: "外观主题", icon: "paintpalette") {
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
                    .padding(.top, 8)
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

            settingsCard(title: "布局模式", icon: "rectangle.split.2x1") {
                Picker("模式", selection: stringBinding(for: "layout_mode", in: settings)) {
                    Text("纵横（默认）").tag("landscape")
                    Text("聚焦").tag("focus")
                }
                Text("纵横模式保留完整侧边栏与多面板；聚焦模式隐藏次要入口，适合沉浸式写作与阅读。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

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
