import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var router: AppRouter
    @EnvironmentObject var colorTokens: AppColorTokens

    private var primaryRoutes: [AppRoute] {
        AppRoute.allCases.filter { $0.group == .primary }
    }

    private var secondaryRoutes: [AppRoute] {
        AppRoute.allCases.filter { $0.group == .secondary }
    }

    var body: some View {
        VStack(spacing: 2) {
            // Logo
            appLogo
                .padding(.bottom, 4)

            divider

            // Primary nav
            ForEach(primaryRoutes) { route in
                NavItem(
                    title: route.title,
                    icon: route.icon,
                    isSelected: router.selectedRoute == route
                ) {
                    router.selectedRoute = route
                }
            }

            divider

            // Secondary nav
            ForEach(secondaryRoutes) { route in
                NavItem(
                    title: route.title,
                    icon: route.icon,
                    isSelected: router.selectedRoute == route
                ) {
                    router.selectedRoute = route
                }
            }

            Spacer()
        }
        .padding(.top, 8)
        .padding(.horizontal, 8)
        .padding(.bottom, 12)
        .frame(width: 76)
        .background(
            LinearGradient(
                colors: [
                    colorTokens.surface.opacity(0.92),
                    colorTokens.surface
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        )
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(colorTokens.border)
                .frame(width: 1)
        }
    }

    private var appLogo: some View {
        Image(systemName: "sparkles")
            .font(.system(size: 22))
            .foregroundStyle(colorTokens.accent)
            .frame(width: 52, height: 52)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(colorTokens.elevated)
            )
            .onTapGesture {
                router.selectedRoute = .copilot
            }
    }

    private var divider: some View {
        LinearGradient(
            colors: [.clear, colorTokens.border.opacity(0.92), .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(height: 1)
        .padding(.horizontal, 9)
        .padding(.vertical, 2)
    }
}

// MARK: - Nav Item

private struct NavItem: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .frame(width: 15, height: 15)

                Text(title)
                    .font(Theme.Typography.navLabel)
                    .lineLimit(1)

                // Accent marker
                if isSelected {
                    RoundedRectangle(cornerRadius: 999)
                        .fill(colorTokens.accent.opacity(0.72))
                        .frame(width: 20, height: 2)
                } else {
                    Spacer()
                        .frame(height: 2)
                }
            }
            .foregroundColor(foregroundForState)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 7)
            .padding(.horizontal, 4)
            .background(backgroundForState)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.navItem, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
            )
            .cornerRadius(Theme.Radii.navItem)
        }
        .buttonStyle(.plain)
        .offset(y: isHovered && !isSelected ? -1 : 0)
        .animation(.easeInOut(duration: 0.18), value: isHovered)
        .onHover { isHovered = $0 }
    }

    private var foregroundForState: Color {
        if isSelected {
            return colorTokens.text
        }
        return isHovered ? colorTokens.textSoft : colorTokens.textMuted
    }

    @ViewBuilder
    private var backgroundForState: some View {
        if isSelected {
            colorTokens.elevated.opacity(0.6)
        } else if isHovered {
            colorTokens.surface.opacity(0.5)
        } else {
            Color.clear
        }
    }

    private var borderColor: Color {
        if isSelected {
            return colorTokens.border.opacity(0.3)
        }
        return Color.clear
    }
}
