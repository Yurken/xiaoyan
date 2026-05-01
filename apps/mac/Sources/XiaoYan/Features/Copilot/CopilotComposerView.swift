import SwiftUI

struct CopilotComposerView: View {
    @Binding var inputText: String
    @Binding var chatMode: ChatMode
    var onSend: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                ForEach(ChatMode.allCases, id: \.self) { mode in
                    Button {
                        chatMode = mode
                    } label: {
                        Text(mode.label)
                            .font(.caption.weight(chatMode == mode ? .semibold : .regular))
                            .foregroundStyle(chatMode == mode ? Color.white : Color.primary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(chatMode == mode ? Color.accentColor : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: 6)
                                    .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                            )
                            .cornerRadius(6)
                    }
                    .buttonStyle(.plain)
                    .help(mode.description)
                }
                Spacer()
                Text(chatMode.description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            HStack(alignment: .bottom, spacing: 8) {
                ZStack(alignment: .topLeading) {
                    if inputText.isEmpty {
                        Text(chatMode.inputPlaceholder)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 12)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $inputText)
                        .font(.body)
                        .lineLimit(1...6)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                }
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)
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
}
