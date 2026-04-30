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
}
