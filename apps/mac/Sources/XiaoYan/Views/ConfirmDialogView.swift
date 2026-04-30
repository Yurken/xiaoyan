import SwiftUI

struct ConfirmDialogView: View {
    let title: String
    let message: String
    var confirmLabel: String = "确认"
    var cancelLabel: String = "取消"
    var isDestructive: Bool = false
    var onConfirm: () -> Void
    var onCancel: () -> Void = {}

    var body: some View {
        VStack(spacing: 16) {
            Text(title)
                .font(.headline)
            Text(message)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            HStack {
                Button(cancelLabel, action: onCancel)
                    .keyboardShortcut(.cancelAction)

                Button(confirmLabel, action: onConfirm)
                    .keyboardShortcut(.defaultAction)
                    .tint(isDestructive ? .red : .accentColor)
            }
        }
        .padding(24)
        .frame(width: 360)
    }
}
