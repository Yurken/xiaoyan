import SwiftUI

enum BadgeVariant {
    case info, success, warning, error, neutral
}

struct BadgeView: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let text: String
    var variant: BadgeVariant? = nil
    var customColor: Color? = nil

    init(text: String, variant: BadgeVariant) {
        self.text = text
        self.variant = variant
    }

    // Backward compat: BadgeView(text: "...", color: .blue)
    init(text: String, color: Color) {
        self.text = text
        self.customColor = color
    }

    var body: some View {
        let tint = customColor ?? resolvedColor
        Text(text)
            .font(.system(size: 11, weight: .bold, design: .rounded))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(tint.opacity(0.14))
            .foregroundStyle(tint)
            .clipShape(Capsule())
    }

    private var resolvedColor: Color {
        switch variant {
        case .info: return colorTokens.info
        case .success: return colorTokens.success
        case .warning: return colorTokens.warning
        case .error: return colorTokens.error
        case .neutral: return colorTokens.textMuted
        case .none: return colorTokens.accent
        }
    }
}
