import SwiftUI

struct GraphCitationPanel: View {
    let citations: [PaperCitation]
    let papers: [Paper]
    let onDelete: (String) -> Void

    private var paperTitleMap: [String: String] {
        Dictionary(uniqueKeysWithValues: papers.map { ($0.id, $0.title) })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("引用关系")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(citations.count) 条")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if citations.isEmpty {
                Text("暂无论文引用关系")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(citations) { citation in
                        CitationRow(
                            citation: citation,
                            citingTitle: paperTitleMap[citation.citingPaperId] ?? citation.citingPaperId,
                            citedTitle: paperTitleMap[citation.citedPaperId] ?? citation.citedPaperId,
                            onDelete: { onDelete(citation.id) }
                        )
                    }
                }
            }
        }
    }
}

private struct CitationRow: View {
    let citation: PaperCitation
    let citingTitle: String
    let citedTitle: String
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "arrowshape.right")
                .foregroundStyle(.blue)
                .font(.caption)

            VStack(alignment: .leading, spacing: 2) {
                Text(citingTitle)
                    .font(.caption.bold())
                    .lineLimit(1)
                HStack(spacing: 2) {
                    Image(systemName: "arrow.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(citedTitle)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                if let context = citation.context {
                    Text(context)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer()

            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}
