import Foundation

@MainActor
final class KnowledgeService: ObservableObject {
    private let knowledgeRepo = KnowledgeRepository()

    // MARK: - Research Interests

    func listInterests() -> [ResearchInterest] {
        (try? knowledgeRepo.listInterests()) ?? []
    }

    func createInterest(topic: String, keywords: [String]?, profile: InterestProfile?) -> ResearchInterest {
        let interest = ResearchInterest(
            id: UUID().uuidString,
            topic: topic,
            folderName: nil,
            keywords: keywords,
            profile: profile,
            learningPath: nil,
            status: nil,
            createdAt: Date()
        )
        try? knowledgeRepo.insertInterest(interest)
        return interest
    }

    func updateInterest(_ interest: ResearchInterest) {
        try? knowledgeRepo.updateInterest(interest)
    }

    func deleteInterest(id: String) {
        try? knowledgeRepo.deleteInterest(id: id)
    }

    /// 删除研究方向 + 级联清空名下笔记/论断（"删除全部"）。
    func deleteInterestBundle(id: String) {
        try? knowledgeRepo.deleteInterestBundle(id: id)
    }

    /// 仅删除研究方向，名下笔记/论断 research_interest_id 置为 NULL（"置为未归档"）。
    func deleteInterestOnly(id: String) {
        try? knowledgeRepo.deleteInterestOnly(id: id)
    }

    func updateInterestFolderName(id: String, folderName: String) {
        try? knowledgeRepo.updateInterestFolder(id: id, folderName: folderName)
    }

    // MARK: - Knowledge Notes

    func listNotes(researchInterestId: String? = nil) -> [KnowledgeNote] {
        (try? knowledgeRepo.listNotes(researchInterestId: researchInterestId)) ?? []
    }

    func createNote(title: String, content: String, researchInterestId: String? = nil, settings: AppSettings) -> KnowledgeNote {
        let note = KnowledgeNote(
            id: UUID().uuidString,
            researchInterestId: researchInterestId,
            title: title,
            content: content,
            sourceType: "manual",
            sourceId: nil,
            tags: nil,
            embedding: nil,
            createdAt: Date()
        )
        try? knowledgeRepo.insertNote(note)

        // Background embedding
        if let embedClient = EmbeddingClient.fromSettings(settings) {
            Task.detached {
                if let embedding = try? await embedClient.embed(text: "\(title) \(content)") {
                    var updated = note
                    updated.embedding = embedding
                    try? self.knowledgeRepo.updateNote(updated)
                }
            }
        }

        return note
    }

    func deleteNote(id: String) {
        try? knowledgeRepo.deleteNote(id: id)
    }

    // MARK: - Learning Path Generation

    func generateLearningPath(interest: ResearchInterest, settings: AppSettings) async -> LearningPath? {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_planner_model", "multi_agent_worker_model"],
            temperatureKeys: []
        ) else { return nil }

        // Set planning status
        var planning = interest
        planning.status = "planning"
        try? knowledgeRepo.updateInterest(planning)

        let prompt = """
        为以下研究方向生成学习路径：
        主题：\(interest.topic)
        关键词：\(interest.keywords?.joined(separator: ", ") ?? "无")
        背景：\(interest.profile?.background ?? "未指定")

        返回 JSON 格式：
        {"stages": [{"title": "...", "description": "...", "duration": "...", "resources": ["..."]}]}
        """

        guard let response = try? await client.chat(
            messages: [LLMClient.Message(role: "user", content: prompt)],
            systemPrompt: "你是一个研究规划专家。返回 JSON 格式的学习路径。"
        ),
        let data = response.data(using: .utf8),
        let path = try? JSONDecoder().decode(LearningPath.self, from: data)
        else {
            // Revert status on failure
            var reverted = interest
            reverted.status = nil
            try? knowledgeRepo.updateInterest(reverted)
            return nil
        }

        var updated = interest
        updated.learningPath = path
        updated.status = "planned"
        try? knowledgeRepo.updateInterest(updated)
        return path
    }

    // MARK: - Standalone Planner Generation

    func generatePlannerResult(topic: String, keywords: [String], settings: AppSettings) async -> LearningPath? {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_planner_model", "multi_agent_worker_model"],
            temperatureKeys: []
        ) else { return nil }

        let prompt = """
        你是一位研究规划专家。请为以下研究方向生成完整的学习路径规划，返回 JSON 格式：

        {
            "overview": "领域概述（200字以内）",
            "prerequisites": [
                {"name": "先修知识名称", "description": "描述", "resources": ["推荐资源"]}
            ],
            "learning_stages": [
                {
                    "stage": 1,
                    "title": "阶段标题",
                    "duration": "预计时长",
                    "goals": ["学习目标1", "学习目标2"],
                    "topics": ["涵盖主题1", "涵盖主题2"],
                    "resources": ["推荐资源"]
                }
            ],
            "classic_papers": [
                {"title": "论文标题", "authors": "作者", "year": 2024, "reason": "推荐理由"}
            ],
            "research_directions": [
                {"direction": "方向名称", "description": "描述", "open_problems": ["开放问题1"]}
            ],
            "tools_and_frameworks": ["工具1", "框架1"]
        }

        研究方向：\(topic)
        关键词：\(keywords.joined(separator: ", "))

        要求：
        - 用中文撰写
        - 提供有深度的分析和具体的学习阶段
        - classic_papers 列出 5-8 篇代表性论文（可包含真实或合理推测的论文）
        - learning_stages 提供 3-6 个阶段
        """

        guard let response = try? await client.chat(
            messages: [LLMClient.Message(role: "user", content: "研究方向：\(topic)")],
            systemPrompt: prompt
        ) else { return nil }

        let clean = response
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = clean.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(LearningPath.self, from: data)
    }

    // MARK: - Interest Hints

    func generateInterestHints(
        topic: String,
        keywords: [String],
        goal: String?,
        background: String?,
        timeBudget: String?,
        constraints: [String]?,
        knownContext: String?,
        preferredOutput: String?,
        settings: AppSettings
    ) async -> InterestHintResponse? {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["planner_hint_model", "multi_agent_planner_model", "multi_agent_worker_model"],
            temperatureKeys: ["planner_hint_temperature"]
        ) else { return nil }

        let form = [
            "- 研究主题：\(topic)",
            keywords.isEmpty ? "- 关键词：未填写" : "- 关键词：\(keywords.joined(separator: "、"))",
            "- 研究目标：\(goal?.isEmpty == false ? goal! : "未填写")",
            "- 当前基础：\(background?.isEmpty == false ? background! : "未填写")",
            "- 时间预算：\(timeBudget?.isEmpty == false ? timeBudget! : "未填写")",
            (constraints?.isEmpty == false) ? "- 约束条件：\(constraints!.joined(separator: "、"))" : "- 约束条件：未填写",
            "- 已知论文/方法：\(knownContext?.isEmpty == false ? knownContext! : "未填写")",
            "- 期望输出：\(preferredOutput?.isEmpty == false ? preferredOutput! : "未填写")",
        ].joined(separator: "\n")

        let prompt = """
        请根据下面这个"正在填写中的研究规划表单"，给出实时补全建议。

        目标：
        1. 用 1-2 句中文总结你当前理解的研究方向，避免空泛。
        2. 判断"现在最值得继续填写的字段" next_field。只能从 topic, keywords, goal, background, time_budget, constraints, known_context, preferred_output 中选择一个。
        3. 给出各字段的候选建议，供界面做点击补全。建议应补充用户输入，而不是重复原文。
        4. 每个数组最多 6 项，尽量短、可直接点击、避免长句。

        只返回合法 JSON，不要包含 markdown、解释或代码块：
        {
          "summary": "一句到两句中文总结",
          "next_field": "keywords",
          "matched_domains": ["领域标签"],
          "keyword_suggestions": ["关键词"],
          "goal_suggestions": ["研究目标建议"],
          "background_prompts": ["当前基础补充问题"],
          "time_budget_suggestions": ["时间预算建议"],
          "constraint_suggestions": ["约束条件建议"],
          "known_context_suggestions": ["已知论文或方法"],
          "output_suggestions": ["期望输出建议"]
        }

        当前表单：
        \(form)
        """

        guard let response = try? await client.chat(
            messages: [LLMClient.Message(role: "user", content: prompt)],
            systemPrompt: "你是一个研究规划表单实时助手。基于用户已填写的信息，判断下一步最值得补充的字段，并给出可直接点击的候选短语。"
        ) else { return nil }

        let clean = response
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = clean.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(InterestHintResponse.self, from: data)
    }

    func suggestTopics(field: String, goalType: String, background: String, settings: AppSettings) async -> [String]? {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["planner_hint_model", "multi_agent_planner_model", "multi_agent_worker_model"],
            temperatureKeys: ["planner_hint_temperature"]
        ) else { return nil }

        let prompt = """
        你是一位资深研究导师，请根据学生情况给出 4~5 个具体、可执行的研究课题方向。

        学生情况：
        - 感兴趣的研究领域：\(field)
        - 希望做的研究类型：\(goalType)
        - 个人背景：\(background.isEmpty ? "未提供" : background)

        要求：
        - 每个课题必须具体可执行，避免宽泛的领域名词
        - 课题名称 10~30 字，使用中文
        - 体现近两年学术前沿或有实际落地价值
        - 仅返回合法 JSON 数组，不要输出任何其他文本：["课题方向1", "课题方向2", ...]
        """

        guard let response = try? await client.chat(
            messages: [LLMClient.Message(role: "user", content: prompt)],
            systemPrompt: "你是一位资深学术导师，擅长帮助研究生找到有价值的研究切入点。"
        ) else { return nil }

        let clean = response
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = clean.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode([String].self, from: data)
    }

    // MARK: - Web Clip

    func webClip(url: String, researchInterestId: String? = nil) async -> KnowledgeNote? {
        guard let url = URL(string: url) else { return nil }
        var request = URLRequest(url: url)
        request.setValue("Mozilla/5.0 (compatible; XiaoYan/1.0)", forHTTPHeaderField: "User-Agent")
        request.timeoutInterval = 15

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            guard let html = String(data: data, encoding: .utf8) else { return nil }

            let title = extractTitle(from: html) ?? url.absoluteString
            let content = stripHTML(html)
            let note = KnowledgeNote(
                id: UUID().uuidString,
                researchInterestId: researchInterestId,
                title: title,
                content: "来源：\(url.absoluteString)\n\n\(content)",
                sourceType: "web_clip",
                sourceId: url.absoluteString,
                tags: nil,
                embedding: nil,
                createdAt: Date()
            )
            try knowledgeRepo.insertNote(note)
            return note
        } catch {
            return nil
        }
    }

    // MARK: - Semantic Search

    func semanticSearchNotes(query: String, settings: AppSettings) async -> [SemanticSearchResult] {
        guard let client = EmbeddingClient.fromSettings(settings) else { return [] }
        do {
            let embedding = try await client.embed(text: query)
            return try knowledgeRepo.searchNotes(queryEmbedding: embedding, topK: 5)
        } catch {
            return []
        }
    }
}

struct InterestHintResponse: Codable {
    let summary: String
    let nextField: String
    let matchedDomains: [String]
    let keywordSuggestions: [String]
    let goalSuggestions: [String]
    let backgroundPrompts: [String]
    let timeBudgetSuggestions: [String]
    let constraintSuggestions: [String]
    let knownContextSuggestions: [String]
    let outputSuggestions: [String]

    enum CodingKeys: String, CodingKey {
        case summary, nextField = "next_field", matchedDomains = "matched_domains"
        case keywordSuggestions = "keyword_suggestions"
        case goalSuggestions = "goal_suggestions"
        case backgroundPrompts = "background_prompts"
        case timeBudgetSuggestions = "time_budget_suggestions"
        case constraintSuggestions = "constraint_suggestions"
        case knownContextSuggestions = "known_context_suggestions"
        case outputSuggestions = "output_suggestions"
    }
}

private func extractTitle(from html: String) -> String? {
    let pattern = "(?i)<title[^>]*>([^<]+)</title>"
    guard let regex = try? NSRegularExpression(pattern: pattern, options: []),
          let match = regex.firstMatch(in: html, options: [], range: NSRange(location: 0, length: html.utf16.count)),
          let range = Range(match.range(at: 1), in: html) else { return nil }
    return String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
}

private func stripHTML(_ html: String) -> String {
    var text = html
    let patterns: [(String, String)] = [
        ("(?is)<script[^>]*>.*?</script>", " "),
        ("(?is)<style[^>]*>.*?</style>", " "),
        ("<[^>]+>", " "),
        ("\\s{2,}", "\n"),
    ]
    for (pattern, replacement) in patterns {
        if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
            text = regex.stringByReplacingMatches(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count), withTemplate: replacement)
        }
    }
    return String(text.prefix(8000))
}
