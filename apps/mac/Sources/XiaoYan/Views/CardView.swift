import SwiftUI

enum CardVariant {
    case raised    // neumorphic raised: gradient bg + dual shadow
    case flat      // lighter shadow
    case inset     // pressed-in look
}

struct CardView<Content: View>: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let content: Content
    var variant: CardVariant = .raised
    var padding: CGFloat = Theme.Spacing.md
    var cornerRadius: CGFloat = Theme.Radii.card

    init(
        variant: CardVariant = .raised,
        padding: CGFloat = Theme.Spacing.md,
        cornerRadius: CGFloat = Theme.Radii.card,
        @ViewBuilder content: () -> Content
    ) {
        self.variant = variant
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(backgroundForVariant)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(borderColor, lineWidth: borderWidth)
            )
            .modifier(ShadowModifier(variant: variant, isDark: isDark))
    }

    private var isDark: Bool {
        colorTokens.cardShadowDark != Color(hex: "CBD0D7")
    }

    @ViewBuilder
    private var backgroundForVariant: some View {
        switch variant {
        case .raised:
            colorTokens.cardGradient
        case .flat:
            colorTokens.surface
        case .inset:
            colorTokens.cardInsetBg
        }
    }

    private var borderColor: Color {
        switch variant {
        case .raised, .flat:
            return colorTokens.border.opacity(0.15)
        case .inset:
            return colorTokens.border.opacity(0.3)
        }
    }

    private var borderWidth: CGFloat {
        switch variant {
        case .raised, .flat: return 0.5
        case .inset: return 1
        }
    }
}

private struct ShadowModifier: ViewModifier {
    let variant: CardVariant
    let isDark: Bool

    func body(content: Content) -> some View {
        switch variant {
        case .raised:
            content.raisedShadow(isDark: isDark)
        case .flat:
            content.flatShadow(isDark: isDark)
        case .inset:
            content.cardShadow(isDark: isDark)
        }
    }
}
