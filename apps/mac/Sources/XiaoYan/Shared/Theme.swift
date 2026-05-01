import SwiftUI

enum Theme {
    enum Colors {
        static let primary = Color(red: 0/255, green: 122/255, blue: 255/255) // Apple Blue #007AFF
        static let background = Color(white: 0.96) // nm-bg
        static let surface = Color(white: 0.98) // nm-surface
        
        static let textPrimary = Color.primary
        static let textSecondary = Color.secondary
        static let textTertiary = Color(white: 0.6)
        
        static let border = Color(white: 0.9)
    }
    
    struct ShadowDef {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
    
    enum Shadows {
        static let soft = ShadowDef(color: Color.black.opacity(0.03), radius: 8, x: 0, y: 4)
        static let inner = ShadowDef(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 6)
        static let medium = ShadowDef(color: Color.black.opacity(0.06), radius: 16, x: 2, y: 6)
        static let floating = ShadowDef(color: Color.black.opacity(0.08), radius: 24, x: 0, y: 12)
        
        // Neumorphic highlight
        static let nmLight = ShadowDef(color: Color.white.opacity(0.9), radius: 8, x: -4, y: -4)
    }
    
    enum Radii {
        static let large: CGFloat = 24
        static let medium: CGFloat = 16
        static let small: CGFloat = 12
    }
    
    enum Spacing {
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 40
    }
}

extension View {
    func nmShadow(level: Theme.ShadowDef = Theme.Shadows.medium) -> some View {
        self.shadow(color: level.color, radius: level.radius, x: level.x, y: level.y)
            .shadow(color: Theme.Shadows.nmLight.color, radius: Theme.Shadows.nmLight.radius, x: Theme.Shadows.nmLight.x, y: Theme.Shadows.nmLight.y)
    }
}
