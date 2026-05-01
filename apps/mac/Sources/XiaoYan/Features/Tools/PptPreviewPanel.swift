import SwiftUI

struct PptPreviewPanel: View {
    let data: PptData
    let onCopyMarkdown: () -> Void
    let onSaveMarkdown: () -> Void
    let onSavePptx: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("幻灯片预览")
                        .font(.subheadline.bold())
                    Text("\(data.title) · \(data.slides.count) 页")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("复制 Markdown") { onCopyMarkdown() }
                    .font(.caption)
                Button("保存 .md") { onSaveMarkdown() }
                    .font(.caption)
                Button("保存 .pptx") { onSavePptx() }
                    .font(.caption.bold())
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
            }
            .padding()

            Divider()

            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 12)], spacing: 12) {
                    ForEach(data.slides) { slide in
                        PptSlideCard(slide: slide)
                    }
                }
                .padding()
            }
        }
    }
}

private struct PptSlideCard: View {
    let slide: PptSlide

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(slide.layout.displayName)
                    .font(.caption2.bold())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(layoutColor.opacity(0.12))
                    .foregroundColor(layoutColor)
                    .cornerRadius(4)
                Spacer()
            }

            Text(slide.title)
                .font(.subheadline.bold())
                .lineLimit(2)

            if let subtitle = slide.subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            if let bullets = slide.bullets, !bullets.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(bullets, id: \.self) { bullet in
                        Text("• \(bullet)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
            }

            if let highlight = slide.highlight {
                Text(highlight)
                    .font(.caption)
                    .italic()
                    .foregroundStyle(.primary)
                    .padding(6)
                    .background(Color.yellow.opacity(0.1))
                    .cornerRadius(6)
            }

            if let steps = slide.steps, !steps.isEmpty {
                FlowLayout(spacing: 4) {
                    ForEach(steps, id: \.self) { step in
                        Text(step)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.08))
                            .cornerRadius(4)
                    }
                }
            }

            if let left = slide.left, let right = slide.right {
                HStack(alignment: .top, spacing: 8) {
                    compactColumn(left)
                    compactColumn(right)
                }
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(layoutColor.opacity(0.2), lineWidth: 1)
        )
        .cornerRadius(8)
    }

    private func compactColumn(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(items, id: \.self) { item in
                Text(item)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var layoutColor: Color {
        switch slide.layout {
        case .title: return .blue
        case .section: return .purple
        case .content: return .green
        case .two_column: return .orange
        case .highlight: return .yellow
        case .timeline: return .teal
        }
    }
}
