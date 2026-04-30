import SwiftUI

struct AnalysisSection: View {
    let title: String
    let icon: String
    let color: Color
    let content: String?

    @State private var isExpanded = true
    @State private var copied = false

    var body: some View {
        guard let content = content, !content.isEmpty else {
            return AnyView(EmptyView())
        }

        return AnyView(
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .foregroundStyle(color)
                    Text(title)
                        .font(.subheadline.bold())
                    Spacer()
                    Button(action: { copy(content) }) {
                        HStack(spacing: 2) {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .font(.caption2)
                            Text(copied ? "已复制" : "复制")
                                .font(.caption2)
                        }
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(copied ? color.opacity(0.12) : Color(nsColor: .windowBackgroundColor))
                        .foregroundColor(copied ? color : .secondary)
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                    Button(action: { isExpanded.toggle() }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
                .padding(10)

                if isExpanded {
                    Text(content)
                        .font(.body)
                        .textSelection(.enabled)
                        .padding(.horizontal, 10)
                        .padding(.bottom, 10)
                }
            }
            .background(Color(nsColor: .controlBackgroundColor))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(color.opacity(0.25), lineWidth: 1)
            )
            .cornerRadius(10)
        )
    }

    private func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            copied = false
        }
    }
}
