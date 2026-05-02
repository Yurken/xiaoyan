import SwiftUI

struct NoteRow: View {
    let note: KnowledgeNote

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(note.title)
                .font(.subheadline.bold())
                .lineLimit(1)
            Text(note.content)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack(spacing: 8) {
                if let tags = note.tags, !tags.isEmpty {
                    ForEach(tags.prefix(3), id: \.self) { tag in
                        Text(tag)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
                Spacer()
                if let date = note.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
