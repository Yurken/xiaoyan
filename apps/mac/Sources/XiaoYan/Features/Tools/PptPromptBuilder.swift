import Foundation

struct PptPromptBuilder {
    private static let jsonSchema = """
    {
      "title": "演示标题",
      "slides": [
        { "layout": "title", "title": "主标题", "subtitle": "副标题" },
        { "layout": "section", "title": "章节页标题", "subtitle": "章节说明（可选）" },
        { "layout": "content", "title": "内容页标题", "bullets": ["要点1", "要点2", "要点3"] },
        { "layout": "two_column", "title": "对比页标题", "left": ["左侧1", "左侧2"], "right": ["右侧1", "右侧2"] },
        { "layout": "highlight", "title": "核心结论页标题", "highlight": "一句话关键结论", "bullets": ["支撑点1", "支撑点2"] },
        { "layout": "timeline", "title": "流程页标题", "steps": ["阶段1", "阶段2", "阶段3"], "note": "流程说明（可选）" }
      ]
    }
    """

    static func buildPrompt(mode: PptMode, topic: String, outline: String, documentContent: String?, styleValue: String, customStyle: String, language: String, pageCount: String, customPages: String) -> String {
        let styleHint = resolveStyleHint(styleValue: styleValue, customStyle: customStyle)
        let languageHint = resolveLanguageHint(language: language)
        let pageHint = resolvePageHint(pageCount: pageCount, customPages: customPages)
        let rules = buildRules(styleHint: styleHint, languageHint: languageHint, pageHint: pageHint)

        switch mode {
        case .topic:
            return """
            请为演示主题“\(topic.trimmingCharacters(in: .whitespacesAndNewlines))”生成一份适合科研汇报的幻灯片数据。

            严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
            格式必须符合：
            \(jsonSchema)

            \(rules)
            """
        case .outline:
            return """
            请根据以下大纲生成一份适合科研汇报的幻灯片数据：

            \(outline.trimmingCharacters(in: .whitespacesAndNewlines))

            严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
            格式必须符合：
            \(jsonSchema)

            \(rules)
            - 严格按照大纲层级组织页面，必要时将连续要点合并成更有节奏的章节结构
            """
        case .document:
            return """
            请根据以下文档内容生成一份适合科研汇报的幻灯片数据：

            \(buildDocumentExcerpt(documentContent ?? ""))

            严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何额外说明。
            格式必须符合：
            \(jsonSchema)

            \(rules)
            - 先提炼文档主线，再组织章节，不要机械地逐段复述原文
            """
        }
    }

    static func buildRepairPrompt(raw: String) -> String {
        """
        请把下面内容修复成一个合法、完整的 JSON 对象，只输出 JSON，不要解释。

        要求：
        - 顶层必须包含 title 和 slides
        - slides 必须是数组
        - layout 只能是 title / section / content / two_column / highlight / timeline
        - 保留原始语义，缺失字段按最合理方式补全

        待修复内容：
        \(String(raw.prefix(12000)))
        """
    }

    private static func buildDocumentExcerpt(_ text: String) -> String {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return normalized }
        if normalized.count <= 7000 { return normalized }
        let head = normalized.prefix(4600)
        let tail = normalized.suffix(1800)
        return "\(head)\n\n[中间已省略 \(normalized.count - 6400) 字原文，请优先根据上下文提炼核心逻辑]\n\n\(tail)"
    }

    private static func resolveStyleHint(styleValue: String, customStyle: String) -> String {
        let effective = styleValue == "custom" ? customStyle.trimmingCharacters(in: .whitespaces) : styleValue
        if effective.isEmpty || effective == "auto" {
            return "根据科研主题与内容深度选择最合适的学术汇报风格"
        }
        return "\(effective)风格"
    }

    private static func resolveLanguageHint(language: String) -> String {
        switch language {
        case "zh": return "全程使用中文"
        case "en": return "All slide copy must be written in English"
        default: return "语言根据主题自动决定，中文主题优先中文，英文主题优先英文"
        }
    }

    private static func resolvePageHint(pageCount: String, customPages: String) -> String {
        let effective = pageCount == "custom" ? customPages.trimmingCharacters(in: .whitespaces) : pageCount
        if let count = Int(effective), count > 0 {
            return "总页数控制在 \(min(40, max(4, count))) 页左右，含标题页和致谢页"
        }
        return "页数由小妍根据内容深度自动决定，建议控制在 10 到 16 页"
    }

    private static func buildRules(styleHint: String, languageHint: String, pageHint: String) -> String {
        """
        风格：\(styleHint)
        语言：\(languageHint)
        页数：\(pageHint)
        布局规则：
        - layout 只能是 title / section / content / two_column / highlight / timeline
        - 第一页固定用 title，最后一页也用 title 作为致谢或总结页
        - 全文包含 2 到 3 个 section 分隔页
        - content 页 bullets 每条尽量不超过 22 个字，最多 5 条
        - two_column 只用于对比、并列方法或优缺点分析
        - highlight 用于核心贡献、主要结论、takeaway，总结语必须简洁有力
        - timeline 用于研究流程、方法步骤、实验阶段、时间线，steps 控制在 3 到 4 个
        - 不要输出 markdown 代码块，不要输出任何解释性文字，只返回一个 JSON 对象
        - 同一份 PPT 中优先使用多种布局，不要连续出现大量同构页面
        """
    }
}
