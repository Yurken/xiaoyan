import SwiftUI

struct KnowledgeClaimPanel: View {
    @EnvironmentObject var colorTokens: AppColorTokens
    let claims: [KnowledgeClaim]
    let evidenceLinks: [EvidenceLink]
    let papers: [Paper]
    let notes: [KnowledgeNote]
    let experiments: [ExperimentRecord]
    var onDeleteClaim: (String) -> Void
    var onUnlinkEvidence: (String) -> Void
    var onChanged: () -> Void

    @State private var confirmDeleteClaimId: String?
    @State private var expandedClaimIds: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("图谱检视")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text("论断与证据")
                        .font(.headline)
                }
                Spacer()
                Text("\(claims.count) 条论断")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)
            .padding(.top)

            Divider()
                .padding(.vertical, 8)

            if claims.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .font(.system(size: 32))
                        .foregroundStyle(.secondary)
                    Text("暂无论断")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, 20)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(claims) { claim in
                            claimRow(claim: claim)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
        }
    }

    // MARK: - Claim Row

    @ViewBuilder
    private func claimRow(claim: KnowledgeClaim) -> some View {
        let isExpanded = expandedClaimIds.contains(claim.id)
        let claimEvidences = evidenceLinks.filter { $0.claimId == claim.id }

        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(width: 12)

                VStack(alignment: .leading, spacing: 2) {
                    Text(claim.title)
                        .font(.subheadline.bold())
                        .lineLimit(1)

                    if let status = claim.status, !status.isEmpty {
                        Text(statusLabel(status))
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 1)
                            .background(statusColor(status).opacity(0.12))
                            .foregroundStyle(statusColor(status))
                            .cornerRadius(4)
                    }
                }

                Spacer()

                if confirmDeleteClaimId == claim.id {
                    HStack(spacing: 4) {
                        Button("删除", role: .destructive) {
                            onDeleteClaim(claim.id)
                            confirmDeleteClaimId = nil
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                        .font(.caption2)

                        Button {
                            confirmDeleteClaimId = nil
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                    }
                } else {
                    Button {
                        confirmDeleteClaimId = claim.id
                    } label: {
                        Image(systemName: "trash")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.borderless)
                    .controlSize(.mini)
                    .help("删除论断")

                    Text("\(claimEvidences.count) 条证据")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .frame(minWidth: 48, alignment: .trailing)
                }
            }
            .padding(10)
            .background(colorTokens.cardInsetBg)
            .cornerRadius(Theme.Radii.medium)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.Radii.medium, style: .continuous)
                    .stroke(colorTokens.border.opacity(0.3), lineWidth: 1)
            )
            .contentShape(Rectangle())
            .onTapGesture {
                withAnimation(.easeInOut(duration: 0.15)) {
                    if isExpanded {
                        expandedClaimIds.remove(claim.id)
                    } else {
                        expandedClaimIds.insert(claim.id)
                    }
                }
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 6) {
                    if !claim.statement.isEmpty {
                        Text(claim.statement)
                            .font(.caption)
                            .foregroundStyle(colorTokens.textSoft)
                            .lineLimit(3)
                            .padding(.horizontal, 10)
                            .padding(.top, 6)
                    }

                    if claimEvidences.isEmpty {
                        Text("暂无绑定证据")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                    } else {
                        ForEach(claimEvidences) { link in
                            evidenceRow(link: link)
                        }
                    }
                }
                .padding(.bottom, 8)
            }
        }
        .background(colorTokens.elevated.opacity(0.3))
        .cornerRadius(Theme.Radii.medium)
    }

    // MARK: - Evidence Row

    @ViewBuilder
    private func evidenceRow(link: EvidenceLink) -> some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: relationIcon(link.relationKind))
                        .font(.caption2)
                        .foregroundStyle(relationColor(link.relationKind))

                    Text(sourceTitle(for: link) ?? link.sourceId)
                        .font(.caption.bold())
                        .lineLimit(1)

                    Text(sourceKindLabel(link.sourceKind))
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 1)
                        .background(colorTokens.elevated)
                        .foregroundStyle(colorTokens.textMuted)
                        .cornerRadius(Theme.Radii.tiny)

                    Spacer()

                    Button {
                        onUnlinkEvidence(link.id)
                    } label: {
                        Image(systemName: "link.badge.minus")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.borderless)
                    .controlSize(.mini)
                    .help("解绑证据")
                }

                if let summary = link.evidenceSummary, !summary.isEmpty {
                    Text(summary)
                        .font(.caption2)
                        .foregroundStyle(colorTokens.textSoft)
                        .lineLimit(2)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func sourceTitle(for link: EvidenceLink) -> String? {
        switch link.sourceKind {
        case "paper": return papers.first(where: { $0.id == link.sourceId })?.title
        case "note": return notes.first(where: { $0.id == link.sourceId })?.title
        case "experiment": return experiments.first(where: { $0.id == link.sourceId })?.title
        default: return nil
        }
    }

    private func sourceKindLabel(_ kind: String) -> String {
        switch kind {
        case "paper": return "论文"
        case "note": return "笔记"
        case "experiment": return "实验"
        default: return kind
        }
    }

    private func relationIcon(_ kind: String) -> String {
        switch kind {
        case "supports": return "checkmark.circle"
        case "contradicts": return "xmark.circle"
        default: return "link"
        }
    }

    private func relationColor(_ kind: String) -> Color {
        switch kind {
        case "supports": return .green
        case "contradicts": return .red
        default: return .blue
        }
    }

    private func statusLabel(_ raw: String) -> String {
        KnowledgeClaimStatus.from(raw)?.displayName ?? raw
    }

    private func statusColor(_ raw: String) -> Color {
        switch raw.lowercased() {
        case "supported", "已验证", "验证": return .green
        case "contested", "已证伪", "证伪": return .red
        case "hypothesis", "待验证", "pending": return .orange
        case "open", "开放问题": return .blue
        default: return .secondary
        }
    }
}
