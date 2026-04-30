import SwiftUI

struct CardView<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding()
            .background(Color(nsColor: .controlBackgroundColor))
            .cornerRadius(12)
    }
}
