import Foundation
import Combine

@MainActor
final class ChatService: ObservableObject {
    @Published var isStreaming = false
    @Published var currentSources: [ChatSource] = []
    @Published var activeAgents: [AgentGraphService.AgentNodeState] = []

    private let chatRepo = ChatRepository()
    private let paperRepo = PaperRepository()
    private let knowledgeRepo = KnowledgeRepository()
    private let memoryRepo = MemoryRepository()

    /// Main chat entry point — decides between simple and agentic mode
    func chat(
        sessionId: String,
        userMessage: String,
        settings: AppSettings
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task { @MainActor in
                self.isStreaming = true
                defer { self.isStreaming = false }

                // Save user message
                let userMsg = ChatMessage(
                    id: UUID().uuidString,
                    sessionId: sessionId,
                    role: "user",
                    content: userMessage,
                    sources: nil,
                    createdAt: Date()
                )
                try? chatRepo.insertMessage(userMsg)

                // Build context
                let contextSummary = buildContextSummary(userMessage: userMessage, settings: settings)
                let history = (try? chatRepo.fetchHistory(sessionId: sessionId, limit: 10)) ?? []

                // Decide mode
                let multiAgentEnabled = settings.get("multi_agent_enabled") == "true"
                if multiAgentEnabled {
                    await runAgentic(
                        sessionId: sessionId,
                        userMessage: userMessage,
                        contextSummary: contextSummary,
                        history: history,
                        settings: settings,
                        continuation: continuation
                    )
                } else {
                    await runSimple(
                        sessionId: sessionId,
                        userMessage: userMessage,
                        contextSummary: contextSummary,
                        history: history,
                        settings: settings,
                        continuation: continuation
                    )
                }
            }
        }
    }

    // MARK: - Simple Mode

    private func runSimple(
        sessionId: String,
        userMessage: String,
        contextSummary: String,
        history: [ChatMessage],
        settings: AppSettings,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["copilot_simple_model"],
            temperatureKeys: ["copilot_simple_temperature"]
        ) else {
            continuation.yield("请先在设置中配置 LLM 提供商。")
            continuation.finish()
            return
        }

        let systemPrompt = buildSystemPrompt(context: contextSummary)
        let messages = buildMessageHistory(history: history, userMessage: userMessage)

        var fullResponse = ""
        do {
            for try await chunk in client.streamChat(messages: messages, systemPrompt: systemPrompt) {
                fullResponse += chunk
                continuation.yield(chunk)
            }

            // Save assistant message
            let assistantMsg = ChatMessage(
                id: UUID().uuidString,
                sessionId: sessionId,
                role: "assistant",
                content: fullResponse,
                sources: currentSources.isEmpty ? nil : currentSources,
                createdAt: Date()
            )
            try? chatRepo.insertMessage(assistantMsg)

            // Record memory
            recordMemoryEvent(sessionId: sessionId, query: userMessage, response: fullResponse)

            continuation.finish()
        } catch {
            continuation.finish(throwing: error)
        }
    }

    // MARK: - Agentic Mode

    private func runAgentic(
        sessionId: String,
        userMessage: String,
        contextSummary: String,
        history: [ChatMessage],
        settings: AppSettings,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async {
        let routingMode = settings.get("multi_agent_routing_mode") ?? "hybrid"
        let enabledAgents = (settings.get("multi_agent_enabled_agents") ?? "").components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }

        let selectedAgents = AgentGraphService.selectAgents(
            query: userMessage,
            routingMode: routingMode,
            enabledAgents: enabledAgents,
            settings: settings
        )

        // Phase 1: Retrieval
        var retrievalResult = await AgentNodesService.retrievalNode(
            query: userMessage,
            settings: settings.settings,
            paperRepo: paperRepo,
            knowledgeRepo: knowledgeRepo
        )

        // Phase 2: Execute worker agents in parallel
        var contextParts: [String] = []
        if !retrievalResult.content.isEmpty {
            contextParts.append(retrievalResult.content)
        }

        await withTaskGroup(of: AgentNodesService.AgentResult.self) { group in
            for agent in selectedAgents where agent != .retrieval && agent != .synthesis {
                group.addTask {
                    switch agent {
                    case .planner:
                        return await AgentNodesService.plannerNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .literatureScout:
                        return await AgentNodesService.literatureScoutNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .survey:
                        return await AgentNodesService.surveyNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .paperAnalyst:
                        return await AgentNodesService.paperAnalystNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .reproduction:
                        return await AgentNodesService.reproductionNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    default:
                        return AgentNodesService.AgentResult(content: "", sources: nil)
                    }
                }
            }

            for await result in group {
                if !result.content.isEmpty {
                    contextParts.append(result.content)
                }
            }
        }

        // Phase 3: Synthesis — stream final response
        let synthesisStream = await AgentNodesService.synthesisNode(
            query: userMessage,
            contextParts: contextParts,
            settings: settings.settings
        )

        var fullResponse = ""
        do {
            for try await chunk in synthesisStream {
                fullResponse += chunk
                continuation.yield(chunk)
            }

            // Save assistant message
            let assistantMsg = ChatMessage(
                id: UUID().uuidString,
                sessionId: sessionId,
                role: "assistant",
                content: fullResponse,
                sources: currentSources.isEmpty ? nil : currentSources,
                createdAt: Date()
            )
            try? chatRepo.insertMessage(assistantMsg)

            recordMemoryEvent(sessionId: sessionId, query: userMessage, response: fullResponse)
            continuation.finish()
        } catch {
            continuation.finish(throwing: error)
        }
    }

    // MARK: - Helpers

    private func buildSystemPrompt(context: String) -> String {
        """
        你是小妍 (XiaoYan)，一个专业的 AI 学术研究助手。你帮助研究人员进行论文阅读、文献调研、研究规划、实验管理和投稿等工作。

        ## 研究背景
        \(context.isEmpty ? "暂无特定研究背景" : context)

        请用中文回答，提供准确、有深度的学术建议。如果引用了相关内容，请注明来源。
        """
    }

    private func buildMessageHistory(history: [ChatMessage], userMessage: String) -> [LLMClient.Message] {
        var messages: [LLMClient.Message] = []
        for msg in history.suffix(10) {
            messages.append(LLMClient.Message(role: msg.role, content: msg.content))
        }
        messages.append(LLMClient.Message(role: "user", content: userMessage))
        return messages
    }

    private func buildContextSummary(userMessage: String, settings: AppSettings) -> String {
        var parts: [String] = []

        // TODO: Add interest context, paper context, memory context
        // This mirrors chat_context_service.rs in the Rust backend

        return parts.joined(separator: "\n\n")
    }

    private func recordMemoryEvent(sessionId: String, query: String, response: String) {
        let event = MemoryEvent(
            id: UUID().uuidString,
            sessionId: sessionId,
            runId: nil,
            eventType: "chat.answer.completed",
            source: "chat",
            summary: String(query.prefix(100)),
            payloadJson: nil,
            createdAt: Date()
        )
        try? memoryRepo.insertEvent(event)
    }
}
