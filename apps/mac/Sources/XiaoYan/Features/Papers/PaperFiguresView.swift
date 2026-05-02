import SwiftUI

struct PaperFiguresView: View {
    let figures: [PaperFigure]
    @State private var selectedFigure: PaperFigure?

    var body: some View {
        ZStack {
            if figures.isEmpty {
                ContentUnavailableView("暂无图片", systemImage: "photo")
                    .frame(maxWidth: .infinity, minHeight: 200)
            } else {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(figures) { figure in
                        FigureCard(figure: figure) {
                            selectedFigure = figure
                        }
                    }
                }
            }

            if let selected = selectedFigure {
                figureLightbox(figure: selected)
            }
        }
    }

    private func figureLightbox(figure: PaperFigure) -> some View {
        GeometryReader { geo in
            ZStack {
                Color.black.opacity(0.92)
                    .ignoresSafeArea()
                    .onTapGesture { selectedFigure = nil }

                VStack(spacing: 12) {
                    Spacer()

                    if let filePath = figure.filePath,
                       FileManager.default.fileExists(atPath: filePath),
                       let nsImage = NSImage(contentsOfFile: filePath) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxWidth: geo.size.width * 0.9, maxHeight: geo.size.height * 0.8)
                    }

                    HStack(spacing: 6) {
                        Text("图 \(figure.figIndex)")
                            .font(.caption.bold())
                            .foregroundStyle(.white)
                        if let caption = figure.caption, !caption.isEmpty {
                            Text(caption)
                                .font(.caption)
                                .foregroundStyle(.white.opacity(0.8))
                        }
                    }
                    .padding(.horizontal)

                    Spacer()
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onTapGesture { selectedFigure = nil }
        .onKeyPress(.escape) { selectedFigure = nil; return .handled }
    }
}

private struct FigureCard: View {
    let figure: PaperFigure
    let onTap: () -> Void

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
                    .onTapGesture(perform: onTap)
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
