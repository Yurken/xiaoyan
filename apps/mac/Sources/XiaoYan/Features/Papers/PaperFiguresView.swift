import SwiftUI

struct PaperFiguresView: View {
    let figures: [PaperFigure]

    var body: some View {
        if figures.isEmpty {
            ContentUnavailableView("暂无图片", systemImage: "photo")
                .frame(maxWidth: .infinity, minHeight: 200)
        } else {
            VStack(alignment: .leading, spacing: 16) {
                ForEach(figures) { figure in
                    FigureCard(figure: figure)
                }
            }
        }
    }
}

private struct FigureCard: View {
    let figure: PaperFigure

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let filePath = figure.filePath,
               FileManager.default.fileExists(atPath: filePath),
               let nsImage = NSImage(contentsOfFile: filePath) {
                Image(nsImage: nsImage)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxHeight: 400)
                    .cornerRadius(8)
            } else {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(nsColor: .controlBackgroundColor))
                    .frame(height: 120)
                    .overlay(
                        ContentUnavailableView("图片不可用", systemImage: "photo")
                    )
            }

            HStack {
                Text("图 \(figure.figIndex)")
                    .font(.caption.bold())
                if let caption = figure.caption, !caption.isEmpty {
                    Text(caption)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}
