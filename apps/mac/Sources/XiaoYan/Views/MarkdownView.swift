import SwiftUI

struct MarkdownView: View {
    let content: String

    var body: some View {
        // TODO: Implement full Markdown + KaTeX rendering
        // For now, use AttributedString basic rendering
        Text(content)
            .textSelection(.enabled)
    }
}
