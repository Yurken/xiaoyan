import SwiftUI

struct CardView<Content: View>: View {
    @ViewBuilder let content: Content
    var padding: CGFloat = Theme.Spacing.md
    var cornerRadius: CGFloat = Theme.Radii.large
    var shadow: Theme.ShadowDef = Theme.Shadows.medium

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Theme.Colors.surface)
                    .nmShadow(level: shadow)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.7), lineWidth: 1.5)
            )
    }
}
