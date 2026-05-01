import Foundation

enum PptFileName {
    static func sanitize(_ name: String) -> String {
        let invalid = CharacterSet(charactersIn: "\\/:*?\"<>|")
        let cleaned = name
            .components(separatedBy: invalid)
            .joined()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        let limited = String(cleaned.prefix(40))
        return limited.isEmpty ? "slides" : limited
    }
}

enum PptMarkdownExporter {
    static func export(data: PptData) -> String {
        var lines: [String] = []
        lines.append("# \(data.title)")
        lines.append("")

        for slide in data.slides {
            switch slide.layout {
            case .title:
                lines.append("## \(slide.title)")
                if let subtitle = slide.subtitle {
                    lines.append(subtitle)
                }
            case .section:
                lines.append("---")
                lines.append("## \(slide.title)")
                if let subtitle = slide.subtitle {
                    lines.append(subtitle)
                }
            case .content:
                lines.append("### \(slide.title)")
                appendList(slide.bullets, to: &lines)
            case .two_column:
                lines.append("### \(slide.title)")
                lines.append("| 左侧 | 右侧 |")
                lines.append("| --- | --- |")
                let left = slide.left ?? []
                let right = slide.right ?? []
                let maxCount = max(left.count, right.count)
                for index in 0..<maxCount {
                    lines.append("| \(index < left.count ? left[index] : "") | \(index < right.count ? right[index] : "") |")
                }
            case .highlight:
                lines.append("### \(slide.title)")
                if let highlight = slide.highlight {
                    lines.append("> \(highlight)")
                }
                appendList(slide.bullets, to: &lines)
            case .timeline:
                lines.append("### \(slide.title)")
                for (index, step) in (slide.steps ?? []).enumerated() {
                    lines.append("\(index + 1). \(step)")
                }
                if let note = slide.note {
                    lines.append("")
                    lines.append(note)
                }
            }
            lines.append("")
        }

        return lines.joined(separator: "\n")
    }

    private static func appendList(_ items: [String]?, to lines: inout [String]) {
        for item in items ?? [] {
            lines.append("- \(item)")
        }
    }
}
