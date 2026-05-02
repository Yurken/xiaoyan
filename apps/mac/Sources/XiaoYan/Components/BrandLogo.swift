import SwiftUI

enum BrandLogo {
    static func image(named name: String) -> Image? {
        guard let url = Bundle.module.url(forResource: name, withExtension: "svg", subdirectory: "brand-logos"),
              let nsImage = NSImage(contentsOf: url) else {
            return nil
        }
        return Image(nsImage: nsImage)
    }
}

struct BrandLogoView: View {
    let name: String
    var width: CGFloat = 80
    var height: CGFloat = 80

    var body: some View {
        if let image = BrandLogo.image(named: name) {
            image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: width, height: height)
        } else {
            Image(systemName: "sparkles")
                .font(.system(size: min(width, height)))
                .foregroundStyle(.orange)
        }
    }
}
