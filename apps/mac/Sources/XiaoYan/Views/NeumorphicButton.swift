import SwiftUI

// MARK: - Button Style Variants

enum NeumorphicButtonStyle {
    case primary, secondary, ghost
}

// MARK: - Primary Button Style

struct NeumorphicPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typography.subheadline)
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(
                LinearGradient(
                    colors: [Color(hex: "1A8AFF"), Color(hex: "0062CC")],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(Theme.Radii.button)
            .shadow(
                color: Color(hex: "0062CC").opacity(configuration.isPressed ? 0.2 : 0.45),
                radius: configuration.isPressed ? 4 : 12,
                x: configuration.isPressed ? 2 : 5,
                y: configuration.isPressed ? 2 : 5
            )
            .shadow(
                color: Color(hex: "3A9BFF").opacity(configuration.isPressed ? 0.15 : 0.30),
                radius: configuration.isPressed ? 3 : 8,
                x: configuration.isPressed ? -1 : -3,
                y: configuration.isPressed ? -1 : -3
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Secondary Button Style

struct NeumorphicSecondaryButtonStyle: ButtonStyle {
    @EnvironmentObject var colorTokens: AppColorTokens

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typography.subheadline)
            .foregroundStyle(colorTokens.textSoft)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(colorTokens.surface)
            .cornerRadius(Theme.Radii.button)
            .shadow(
                color: colorTokens.cardShadowDark.opacity(configuration.isPressed ? 0.1 : 0.3),
                radius: configuration.isPressed ? 3 : 12,
                x: configuration.isPressed ? 2 : 5,
                y: configuration.isPressed ? 2 : 5
            )
            .shadow(
                color: colorTokens.cardShadowLight.opacity(configuration.isPressed ? 0.1 : 0.3),
                radius: configuration.isPressed ? 3 : 12,
                x: configuration.isPressed ? -2 : -5,
                y: configuration.isPressed ? -2 : -5
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Ghost Button Style

struct NeumorphicGhostButtonStyle: ButtonStyle {
    @EnvironmentObject var colorTokens: AppColorTokens

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.Typography.caption)
            .foregroundStyle(colorTokens.textMuted)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                configuration.isPressed
                    ? colorTokens.elevated.opacity(0.5)
                    : Color.clear
            )
            .cornerRadius(Theme.Radii.small)
            .animation(.easeInOut(duration: 0.12), value: configuration.isPressed)
    }
}

// MARK: - Convenience Views

struct NeumorphicButton: View {
    let label: String
    var icon: String? = nil
    var style: NeumorphicButtonStyle = .primary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text(label)
                if let icon {
                    Image(systemName: icon)
                        .font(.caption)
                }
            }
        }
        .neumorphicStyle(style)
    }
}

extension View {
    @ViewBuilder
    func neumorphicStyle(_ style: NeumorphicButtonStyle) -> some View {
        switch style {
        case .primary:
            self.buttonStyle(NeumorphicPrimaryButtonStyle())
        case .secondary:
            self.buttonStyle(NeumorphicSecondaryButtonStyle())
        case .ghost:
            self.buttonStyle(NeumorphicGhostButtonStyle())
        }
    }
}
