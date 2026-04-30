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
            status: "active",
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
        else { return nil }

        var updated = interest
        updated.learningPath = path
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
}
