import SwiftUI

struct CopilotComposerView: View {
    @Binding var inputText: String
    var onSend: () -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextEditor(text: $inputText)
                .font(.body)
                .lineLimit(1...6)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(12)
                .frame(minHeight: 40, maxHeight: 120)

            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
            }
            .buttonStyle(.plain)
            .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .padding(.bottom, 4)
        }
    }
}
