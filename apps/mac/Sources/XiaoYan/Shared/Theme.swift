import SwiftUI

// MARK: - Color(hex:) Extension

extension Color {
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch cleaned.count {
        case 3: (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default: (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255, opacity: Double(a) / 255)
    }
}

// MARK: - Theme Color Palette

struct ThemeColorPalette {
    let accent: Color
    let background: Color
    let surface: Color
    let elevated: Color
    let border: Color
    let text: Color
    let textSoft: Color
    let textMuted: Color
    let cardBgTop: Color
    let cardBgBottom: Color
    let cardInsetBg: Color
    let success: Color
    let warning: Color
    let error: Color
    let info: Color

    // Light neumorphic shadows (used when light theme)
    let cardShadowDark: Color
    let cardShadowLight: Color

    static let dark = ThemeColorPalette(
        accent: Color(hex: "007AFF"),
        background: Color(hex: "090B10"),
        surface: Color(hex: "11151C"),
        elevated: Color(hex: "1D2430"),
        border: Color(hex: "242D3A"),
        text: Color(hex: "F5F7FA"),
        textSoft: Color(hex: "C7D0DC"),
        textMuted: Color(hex: "8D99AA"),
        cardBgTop: Color(hex: "161C28"),
        cardBgBottom: Color(hex: "0D1117"),
        cardInsetBg: Color(hex: "0B0F15"),
        success: Color(hex: "34C759"),
        warning: Color(hex: "FF9500"),
        error: Color(hex: "FF3B30"),
        info: Color(hex: "007AFF"),
        cardShadowDark: Color(hex: "05070B"),
        cardShadowLight: Color(hex: "171E28")
    )

    static let light = ThemeColorPalette(
        accent: Color(hex: "007AFF"),
        background: Color(hex: "F0F4F8"),
        surface: Color(hex: "E8ECF0"),
        elevated: Color(hex: "F4F6F9"),
        border: Color(red: 200/255, green: 205/255, blue: 211/255, opacity: 0.55),
        text: Color(hex: "1A2233"),
        textSoft: Color(hex: "3C4655"),
        textMuted: Color(hex: "6B7480"),
        cardBgTop: Color(hex: "F8FAFC"),
        cardBgBottom: Color(hex: "E6EAF0"),
        cardInsetBg: Color(hex: "E2E6EC"),
        success: Color(hex: "34C759"),
        warning: Color(hex: "FF9500"),
        error: Color(hex: "FF3B30"),
        info: Color(hex: "007AFF"),
        cardShadowDark: Color(hex: "CBD0D7"),
        cardShadowLight: Color.white
    )

    var cardGradient: LinearGradient {
        LinearGradient(
            colors: [cardBgTop, cardBgBottom],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [background, surface],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - App Color Tokens (runtime, @EnvironmentObject)

@MainActor
final class AppColorTokens: ObservableObject {
    @Published var palette: ThemeColorPalette

    init(scheme: ColorScheme = .dark) {
        self.palette = scheme == .dark ? .dark : .light
    }

    func update(for scheme: ColorScheme) {
        palette = scheme == .dark ? .dark : .light
    }

    // Convenience accessors
    var accent: Color { palette.accent }
    var background: Color { palette.background }
    var surface: Color { palette.surface }
    var elevated: Color { palette.elevated }
    var border: Color { palette.border }
    var text: Color { palette.text }
    var textSoft: Color { palette.textSoft }
    var textMuted: Color { palette.textMuted }
    var cardBgTop: Color { palette.cardBgTop }
    var cardBgBottom: Color { palette.cardBgBottom }
    var cardInsetBg: Color { palette.cardInsetBg }
    var cardGradient: LinearGradient { palette.cardGradient }
    var backgroundGradient: LinearGradient { palette.backgroundGradient }
    var success: Color { palette.success }
    var warning: Color { palette.warning }
    var error: Color { palette.error }
    var info: Color { palette.info }
    var cardShadowDark: Color { palette.cardShadowDark }
    var cardShadowLight: Color { palette.cardShadowLight }
}

// MARK: - Static Theme Tokens

enum Theme {

    // Legacy static Colors (kept for backward compat during migration)
    enum Colors {
        static let primary = Color(hex: "007AFF")
        static let background = Color(white: 0.96)
        static let surface = Color(white: 0.98)
        static let textPrimary = Color.primary
        static let textSecondary = Color.secondary
        static let textTertiary = Color(white: 0.6)
        static let border = Color(white: 0.9)
    }

    // Apple semantic colors
    enum Apple {
        static let blue = Color(hex: "007AFF")
        static let orange = Color(hex: "FF9500")
        static let green = Color(hex: "34C759")
        static let red = Color(hex: "FF3B30")
        static let purple = Color(hex: "AF52DE")
        static let teal = Color(hex: "5AC8FA")
    }

    // Typography
    enum Typography {
        static let largeTitle = Font.system(size: 48, weight: .semibold, design: .default)
        static let heroTitle = Font.system(size: 32, weight: .semibold, design: .default)
        static let headline = Font.system(size: 16, weight: .semibold, design: .default)
        static let body = Font.system(size: 14, weight: .regular, design: .default)
        static let subheadline = Font.system(size: 13, weight: .semibold, design: .default)
        static let caption = Font.system(size: 12, weight: .regular, design: .default)
        static let caption2 = Font.system(size: 11, weight: .regular, design: .default)
        static let navLabel = Font.system(size: 9, weight: .bold, design: .default)
        static let kicker = Font.system(size: 11, weight: .bold, design: .default)
        static let metricValue = Font.system(size: 24, weight: .semibold, design: .rounded).monospacedDigit()
    }

    // Shadows
    struct ShadowDef {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }

    enum Shadows {
        // Light neumorphic (current)
        static let soft = ShadowDef(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 4)
        static let inner = ShadowDef(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 6)
        static let medium = ShadowDef(color: Color.black.opacity(0.06), radius: 16, x: 2, y: 6)
        static let floating = ShadowDef(color: Color.black.opacity(0.08), radius: 24, x: 0, y: 12)
        static let nmLight = ShadowDef(color: Color.white.opacity(0.9), radius: 8, x: -4, y: -4)
    }

    // Border radii
    enum Radii {
        static let large: CGFloat = 24
        static let card: CGFloat = 24
        static let medium: CGFloat = 16
        static let subCard: CGFloat = 22
        static let small: CGFloat = 12
        static let button: CGFloat = 16
        static let badge: CGFloat = 999
        static let navItem: CGFloat = 16
        static let tiny: CGFloat = 6
    }

    // Spacing
    enum Spacing {
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 40
    }
}

// MARK: - Neumorphic Shadow View Extension

extension View {
    func nmShadow(level: Theme.ShadowDef = Theme.Shadows.medium) -> some View {
        self.shadow(color: level.color, radius: level.radius, x: level.x, y: level.y)
            .shadow(color: Theme.Shadows.nmLight.color, radius: Theme.Shadows.nmLight.radius, x: Theme.Shadows.nmLight.x, y: Theme.Shadows.nmLight.y)
    }

    /// Desktop-style card neumorphic shadow (dark bottom-right + light top-left)
    @ViewBuilder func cardShadow(isDark: Bool = true) -> some View {
        if isDark {
            self
                .shadow(color: Color(hex: "05070B"), radius: 14, x: 6, y: 6)
                .shadow(color: Color(hex: "171E28"), radius: 14, x: -6, y: -6)
        } else {
            self
                .shadow(color: Color(hex: "CBD0D7"), radius: 16, x: 6, y: 6)
                .shadow(color: .white, radius: 16, x: -6, y: -6)
        }
    }

    /// Desktop-style raised shadow (card + white inset highlight)
    @ViewBuilder func raisedShadow(isDark: Bool = true) -> some View {
        if isDark {
            self
                .shadow(color: .white.opacity(0.05), radius: 0, x: 0, y: 0)
                .shadow(color: .white.opacity(0.2), radius: 2, x: 1, y: 1)
                .shadow(color: Color(hex: "05070B"), radius: 16, x: 6, y: 6)
                .shadow(color: Color(hex: "171E28"), radius: 12, x: -4, y: -4)
        } else {
            self
                .shadow(color: Color(hex: "CBD0D7"), radius: 16, x: 6, y: 6)
                .shadow(color: .white, radius: 16, x: -6, y: -6)
        }
    }

    /// Desktop-style flat shadow
    @ViewBuilder func flatShadow(isDark: Bool = true) -> some View {
        if isDark {
            self
                .shadow(color: .white.opacity(0.03), radius: 0, x: 0, y: 0)
                .shadow(color: .white.opacity(0.1), radius: 1, x: 1, y: 1)
                .shadow(color: Color(hex: "05070B"), radius: 8, x: 3, y: 3)
                .shadow(color: Color(hex: "161C25"), radius: 6, x: -3, y: -3)
        } else {
            self
                .shadow(color: Color(hex: "CBD0D7"), radius: 8, x: 3, y: 3)
                .shadow(color: .white, radius: 8, x: -3, y: -3)
        }
    }
}
