import SwiftUI

struct MessageBubbleView: View {
    let message: ChatDisplayMessage

    var body: some View {
        HStack(alignment: .top) {
            if message.role == .user { Spacer() }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(10)
                    .background(message.role == .user ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
                    .foregroundStyle(message.role == .user ? .white : .primary)
                    .cornerRadius(12)

                if message.isStreaming {
                    ProgressView()
                        .controlSize(.small)
                }
            }

            if message.role == .assistant { Spacer() }
        }
    }
}
