import SwiftUI

// MARK: - Basic Field

struct SettingField: View {
    let label: String
    let key: String
    @ObservedObject var settings: AppSettings
    var placeholder: String = ""

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)
            TextField(placeholder.isEmpty ? label : placeholder, text: Binding(
                get: { settings.get(key) ?? "" },
                set: { settings.set(key, $0) }
            ))
            .textFieldStyle(.roundedBorder)
        }
    }
}

// MARK: - Secure Field

struct SecureSettingField: View {
    let label: String
    let key: String
    @ObservedObject var settings: AppSettings
    var placeholder: String = ""
    @State private var isVisible = false
    @State private var text = ""

    var body: some View {
        HStack {
            Text(label)
                .frame(width: 120, alignment: .leading)

            Group {
                if isVisible {
                    TextField(placeholder, text: $text)
                } else {
                    SecureField(placeholder, text: $text)
                }
            }
            .textFieldStyle(.roundedBorder)
            .onAppear { text = settings.get(key) ?? "" }
            .onDisappear { settings.set(key, text) }
            .onChange(of: text) { _, newValue in settings.set(key, newValue) }

            Button(action: { isVisible.toggle() }) {
                Image(systemName: isVisible ? "eye.slash" : "eye")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Toggle Binding Helper

@MainActor
func boolBinding(for key: String, in settings: AppSettings) -> Binding<Bool> {
    Binding(
        get: { settings.get(key) == "true" },
        set: { settings.set(key, $0 ? "true" : "false") }
    )
}

@MainActor
func stringBinding(for key: String, in settings: AppSettings) -> Binding<String> {
    Binding(
        get: { settings.get(key) ?? "" },
        set: { settings.set(key, $0) }
    )
}
