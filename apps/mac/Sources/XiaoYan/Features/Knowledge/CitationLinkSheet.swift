import SwiftUI

struct CitationLinkSheet: View {
    let citing: GraphNode  // 必须是 .paper
    let cited: GraphNode   // 必须是 .paper
    var onCreated: (PaperCitation) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var context: String = ""
    @State private var errorMessage: String? = nil

    private let repo = KnowledgeRepository()

    var body: some View {
        VStack(spacing: 16) {
            Text("记录引用关系")
                .font(.headline)

            relationRow
                .padding(10)
                .frame(maxWidth: .infinity)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)

            Form {
                Section(header: Text("引用上下文（可选）").font(.caption)) {
                    TextEditor(text: $context)
                        .frame(minHeight: 80)
                }
            }
            .formStyle(.grouped)

            if let errorMessage {
                Text(errorMessage)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
            }

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("保存") { submit() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(citing.type != .paper || cited.type != .paper || citing.id == cited.id)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 520, height: 380)
    }

    private var relationRow: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("引用方")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(citing.label)
                    .font(.caption.bold())
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "arrow.right")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text("被引用")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(cited.label)
                    .font(.caption.bold())
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func submit() {
        let trimmed = context.trimmingCharacters(in: .whitespacesAndNewlines)
        let citation = PaperCitation(
            id: UUID().uuidString,
            citingPaperId: citing.id,
            citedPaperId: cited.id,
            context: trimmed.isEmpty ? nil : trimmed
        )
        do {
            try repo.insertCitation(citation)
        } catch {
            errorMessage = "保存失败：\(error.localizedDescription)"
            return
        }
        onCreated(citation)
        dismiss()
    }
}
