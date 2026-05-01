import SwiftUI

struct EvidenceLinkSheet: View {
    let claim: GraphNode      // type 必须是 .claim
    let evidence: GraphNode   // type 是 .paper / .note / .experiment
    var onCreated: (EvidenceLink) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var relation: RelationKind = .supports
    @State private var summary: String = ""

    private let repo = KnowledgeRepository()

    var body: some View {
        VStack(spacing: 16) {
            Text("绑定证据")
                .font(.headline)

            VStack(spacing: 6) {
                relationRow
            }
            .padding(10)
            .frame(maxWidth: .infinity)
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)

            Form {
                Picker("关系", selection: $relation) {
                    Text("支持").tag(RelationKind.supports)
                    Text("反驳").tag(RelationKind.contradicts)
                    Text("背景").tag(RelationKind.background)
                }
                .pickerStyle(.segmented)

                Section(header: Text("证据摘要").font(.caption)) {
                    TextEditor(text: $summary)
                        .frame(minHeight: 80)
                }
            }
            .formStyle(.grouped)

            HStack {
                Button("取消") { dismiss() }
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("保存") { submit() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(claim.type != .claim || !isValidEvidenceType)
            }
            .padding(.horizontal)
        }
        .padding()
        .frame(width: 520, height: 420)
    }

    private var relationRow: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("论断")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(claim.label)
                    .font(.caption.bold())
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "arrow.left")
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(evidenceLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(evidence.label)
                    .font(.caption.bold())
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var evidenceLabel: String {
        switch evidence.type {
        case .paper: return "论文"
        case .note: return "笔记"
        case .experiment: return "实验"
        default: return "节点"
        }
    }

    private var isValidEvidenceType: Bool {
        [.paper, .note, .experiment].contains(evidence.type)
    }

    private var sourceKind: String {
        switch evidence.type {
        case .paper: return "paper"
        case .note: return "note"
        case .experiment: return "experiment"
        default: return "paper"
        }
    }

    private func submit() {
        let trimmed = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        let link = EvidenceLink(
            id: UUID().uuidString,
            claimId: claim.id,
            sourceKind: sourceKind,
            sourceId: evidence.id,
            relationKind: relation.rawValue,
            evidenceSummary: trimmed.isEmpty ? nil : trimmed
        )
        try? repo.insertEvidenceLink(link)
        onCreated(link)
        dismiss()
    }
}
