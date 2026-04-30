import SwiftUI

struct MarkdownText: View {
    let content: String

    var body: some View {
        let segments = parseSegments(from: content)
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(segments.enumerated()), id: \.offset) { _, segment in
                switch segment {
                case .text(let text):
                    if let attributed = try? AttributedString(
                        markdown: text,
                        options: AttributedString.MarkdownParsingOptions(
                            interpretedSyntax: .full,
                            failurePolicy: .returnPartiallyParsedIfPossible
                        )
                    ) {
                        Text(attributed)
                            .textSelection(.enabled)
                    } else {
                        Text(text)
                            .textSelection(.enabled)
                    }
                case .codeBlock(let language, let code):
                    VStack(alignment: .leading, spacing: 4) {
                        if !language.isEmpty {
                            Text(language)
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 8)
                                .padding(.top, 6)
                        }
                        Text(code)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                    }
                    .background(Color(nsColor: .textBackgroundColor))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
                    )
                }
            }
        }
    }

    private enum Segment {
        case text(String)
        case codeBlock(language: String, code: String)
    }

    private func parseSegments(from text: String) -> [Segment] {
        var segments: [Segment] = []
        let pattern = "```(\\w*)\\n?([\\s\\S]*?)```"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return [.text(text)]
        }
        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: nsRange)

        var currentIndex = text.startIndex
        for match in matches {
            if let range = Range(match.range, in: text) {
                if currentIndex < range.lowerBound {
                    let before = String(text[currentIndex..<range.lowerBound])
                    if !before.isEmpty {
                        segments.append(.text(before))
                    }
                }
                let lang = (Range(match.range(at: 1), in: text).flatMap { String(text[$0]) }) ?? ""
                let code = (Range(match.range(at: 2), in: text).flatMap { String(text[$0]) }) ?? ""
                segments.append(.codeBlock(language: lang, code: code))
                currentIndex = range.upperBound
            }
        }
        if currentIndex < text.endIndex {
            let after = String(text[currentIndex..<text.endIndex])
            if !after.isEmpty {
                segments.append(.text(after))
            }
        }
        return segments.isEmpty ? [.text(text)] : segments
    }
}
