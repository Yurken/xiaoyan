import Foundation

enum PptParsingError: LocalizedError {
    case missingJsonObject
    case incompleteJsonObject
    case invalidRoot
    case emptySlides

    var errorDescription: String? {
        switch self {
        case .missingJsonObject:
            return "模型未返回有效 JSON 对象。"
        case .incompleteJsonObject:
            return "模型返回的 JSON 不完整，请重试。"
        case .invalidRoot:
            return "模型返回格式错误：缺少演示数据对象。"
        case .emptySlides:
            return "模型返回格式错误：slides 不能为空。"
        }
    }
}

enum PptResponseParser {
    static func parse(_ text: String) throws -> PptData {
        let jsonText = try extractJsonObject(from: text)
        guard let data = jsonText.data(using: .utf8),
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw PptParsingError.invalidRoot
        }
        return try normalize(object)
    }

    static func extractJsonObject(from text: String) throws -> String {
        let cleaned = text
            .replacingOccurrences(of: #"```(?:json)?\s*"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let start = cleaned.firstIndex(of: "{") else {
            throw PptParsingError.missingJsonObject
        }

        var depth = 0
        var inString = false
        var escaped = false
        var index = start

        while index < cleaned.endIndex {
            let char = cleaned[index]
            if inString {
                if escaped {
                    escaped = false
                } else if char == "\\" {
                    escaped = true
                } else if char == "\"" {
                    inString = false
                }
            } else if char == "\"" {
                inString = true
            } else if char == "{" {
                depth += 1
            } else if char == "}" {
                depth -= 1
                if depth == 0 {
                    return String(cleaned[start...index])
                }
            }
            index = cleaned.index(after: index)
        }

        throw PptParsingError.incompleteJsonObject
    }

    private static func normalize(_ object: [String: Any]) throws -> PptData {
        guard let rawSlides = object["slides"] as? [Any], !rawSlides.isEmpty else {
            throw PptParsingError.emptySlides
        }

        let title = normalizedString(object["title"]) ?? "演示文稿"
        let slides = rawSlides.prefix(40).enumerated().map { index, item in
            normalizeSlide(item, index: index)
        }

        return PptData(title: title, slides: slides)
    }

    private static func normalizeSlide(_ item: Any, index: Int) -> PptSlide {
        let source = item as? [String: Any] ?? [:]
        let layout = normalizedLayout(source["layout"])
        let title = normalizedString(source["title"]) ?? "第 \(index + 1) 页"
        let bullets = normalizedLines(source["bullets"])
        let left = normalizedLines(source["left"])
        let right = normalizedLines(source["right"])
        let explicitSteps = normalizedLines(source["steps"]).map { Array($0.prefix(4)) }
        let fallbackSteps = bullets.map { Array($0.prefix(4)) }
        let steps = explicitSteps ?? fallbackSteps
        let subtitle = normalizedString(source["subtitle"])
        let highlight = normalizedString(source["highlight"]) ?? subtitle ?? bullets?.first

        return PptSlide(
            layout: layout,
            title: title,
            subtitle: subtitle,
            bullets: bullets,
            left: left,
            right: right,
            highlight: highlight,
            steps: steps,
            note: normalizedString(source["note"])
        )
    }

    private static func normalizedLayout(_ value: Any?) -> PptLayout {
        guard let raw = normalizedString(value),
              let layout = PptLayout(rawValue: raw) else {
            return .content
        }
        return layout
    }

    private static func normalizedString(_ value: Any?) -> String? {
        guard let text = value as? String else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func normalizedLines(_ value: Any?) -> [String]? {
        guard let values = value as? [Any] else { return nil }
        let strings: [String] = values.compactMap { normalizedString($0) }
        let lines = Array(strings.prefix(5))
        return lines.isEmpty ? nil : lines
    }
}
