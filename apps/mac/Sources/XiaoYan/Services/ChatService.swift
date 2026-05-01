import Foundation
import Combine

struct AgentPlanStep: Identifiable {
    let id = UUID()
    let agentName: String
    let title: String
    let goal: String
}

struct AgentRunDisplay: Identifiable {
    let id: String
    let agentName: String
    let stepName: String
    var status: AgentStatus
    var summary: String?
    var error: String?
    var orderIndex: Int
}

@MainActor
final class ChatService: ObservableObject {
    @Published var isStreaming = false
    @Published var currentSources: [ChatSource] = []
    @Published var activeAgents: [AgentGraphService.AgentNodeState] = []

    // MissionControl state
    @Published var currentPlan: [AgentPlanStep] = []
    @Published var currentRuns: [AgentRunDisplay] = []
    @Published var currentRequestId: String?
    @Published var streamError: String?
    @Published var currentArtifacts: [AgentArtifact] = []

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
            let task = Task { @MainActor in
                self.isStreaming = true
                defer { self.isStreaming = false }
                self.currentSources = []

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
                let contextSummary = buildContextSummary(sessionId: sessionId, userMessage: userMessage, settings: settings)
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
            continuation.onTermination = { _ in
                task.cancel()
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
        let requestId = UUID().uuidString
        self.currentRequestId = requestId
        self.streamError = nil

        let routingMode = settings.get("multi_agent_routing_mode") ?? "hybrid"
        let enabledAgents = (settings.get("multi_agent_enabled_agents") ?? "").components(separatedBy: ",")
            .map { $0.trimmingCharacters(in: .whitespaces) }

        let selectedAgents = AgentGraphService.selectAgents(
            query: userMessage,
            routingMode: routingMode,
            enabledAgents: enabledAgents,
            settings: settings
        )

        // Build plan
        let plan = selectedAgents.enumerated().map { idx, agent in
            AgentPlanStep(
                agentName: agent.rawValue,
                title: "\(idx + 1). \(agent.displayName)",
                goal: agentGoal(agent)
            )
        }
        self.currentPlan = plan

        // Phase 1: Retrieval
        let retrievalRunId = UUID().uuidString
        var retrievalRun = AgentRunDisplay(
            id: retrievalRunId,
            agentName: "retrieval",
            stepName: "检索",
            status: .running,
            summary: nil,
            error: nil,
            orderIndex: 0
        )
        self.currentRuns = [retrievalRun]
        persistRun(display: retrievalRun, sessionId: sessionId, requestId: requestId)

        let retrievalResult = await AgentNodesService.retrievalNode(
            query: userMessage,
            settings: settings.settings,
            paperRepo: paperRepo,
            knowledgeRepo: knowledgeRepo
        )
        retrievalRun.status = .done
        retrievalRun.summary = "检索完成"
        self.currentRuns = [retrievalRun]
        updateRunStatus(id: retrievalRunId, status: .done, summary: "检索完成")

        // Populate sources from retrieval
        if let sources = retrievalResult.sources {
            self.currentSources = sources.compactMap { dict in
                guard let id = dict["id"] as? String,
                      let title = dict["title"] as? String else { return nil }
                let score = dict["score"] as? Double ?? 0
                return ChatSource(id: id, title: title, score: score)
            }
        }

        // Phase 2: Execute worker agents in parallel
        var contextParts: [String] = []
        if !retrievalResult.content.isEmpty {
            contextParts.append(retrievalResult.content)
        }

        var workerRuns: [AgentRunDisplay] = []
        let workerAgents = selectedAgents.filter { $0 != .retrieval && $0 != .synthesis }
        for (idx, agent) in workerAgents.enumerated() {
            let runId = UUID().uuidString
            let run = AgentRunDisplay(
                id: runId,
                agentName: agent.rawValue,
                stepName: agent.displayName,
                status: .pending,
                summary: nil,
                error: nil,
                orderIndex: idx + 1
            )
            workerRuns.append(run)
            persistRun(display: run, sessionId: sessionId, requestId: requestId)
        }
        self.currentRuns = [retrievalRun] + workerRuns

        await withTaskGroup(of: (Int, AgentNodesService.AgentResult).self) { group in
            for (idx, agent) in workerAgents.enumerated() {
                group.addTask {
                    // Mark running
                    await MainActor.run {
                        workerRuns[idx].status = .running
                        self.currentRuns = [retrievalRun] + workerRuns
                        self.updateRunStatus(id: workerRuns[idx].id, status: .running, summary: nil)
                    }
                    let result: AgentNodesService.AgentResult
                    switch agent {
                    case .planner:
                        result = await AgentNodesService.plannerNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .literatureScout:
                        result = await AgentNodesService.literatureScoutNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .survey:
                        result = await AgentNodesService.surveyNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .paperAnalyst:
                        result = await AgentNodesService.paperAnalystNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    case .reproduction:
                        result = await AgentNodesService.reproductionNode(query: userMessage, context: contextSummary, settings: settings.settings)
                    default:
                        result = AgentNodesService.AgentResult(content: "", sources: nil)
                    }
                    return (idx, result)
                }
            }

            for await (idx, result) in group {
                if !result.content.isEmpty {
                    contextParts.append(result.content)
                    let artifact = AgentArtifact(
                        id: UUID().uuidString,
                        runId: workerRuns[idx].id,
                        artifactType: workerRuns[idx].agentName,
                        title: workerRuns[idx].stepName,
                        content: result.content,
                        createdAt: Date()
                    )
                    self.currentArtifacts.append(artifact)
                    try? self.chatRepo.insertAgentArtifact(artifact)
                }
                workerRuns[idx].status = .done
                workerRuns[idx].summary = "执行完成"
                self.updateRunStatus(id: workerRuns[idx].id, status: .done, summary: "执行完成")
                await MainActor.run {
                    self.currentRuns = [retrievalRun] + workerRuns
                }
            }
        }

        // Phase 3: Synthesis
        let synthRunId = UUID().uuidString
        var synthRun = AgentRunDisplay(
            id: synthRunId,
            agentName: "synthesis",
            stepName: "综合",
            status: .running,
            summary: nil,
            error: nil,
            orderIndex: workerRuns.count + 1
        )
        self.currentRuns = [retrievalRun] + workerRuns + [synthRun]
        persistRun(display: synthRun, sessionId: sessionId, requestId: requestId)

        let synthesisStream = AgentNodesService.synthesisNode(
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

            synthRun.status = .done
            synthRun.summary = "综合完成"
            self.currentRuns = [retrievalRun] + workerRuns + [synthRun]
            updateRunStatus(id: synthRunId, status: .done, summary: "综合完成")

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
            synthRun.status = .failed
            synthRun.error = error.localizedDescription
            self.currentRuns = [retrievalRun] + workerRuns + [synthRun]
            self.streamError = error.localizedDescription
            updateRunStatus(id: synthRunId, status: .failed, summary: nil, error: error.localizedDescription)
            continuation.finish(throwing: error)
        }
    }

    // MARK: - Persistence Helpers

    private func persistRun(display: AgentRunDisplay, sessionId: String, requestId: String) {
        let run = AgentRun(
            id: display.id,
            sessionId: sessionId,
            requestId: requestId,
            parentRunId: nil,
            agentName: display.agentName,
            stepName: display.stepName,
            status: display.status,
            orderIndex: display.orderIndex,
            inputPayload: nil,
            outputPayload: nil,
            summary: display.summary,
            error: display.error,
            createdAt: Date()
        )
        try? chatRepo.insertAgentRun(run)
    }

    private func updateRunStatus(id: String, status: AgentStatus, summary: String?, error: String? = nil) {
        try? chatRepo.updateAgentRunStatus(id: id, status: status, summary: summary, error: error)
    }

    func loadHistoricalRuns(sessionId: String, requestId: String?) {
        guard let requestId = requestId else {
            currentRuns = []
            currentArtifacts = []
            currentPlan = []
            return
        }
        let runs = (try? chatRepo.listAgentRuns(sessionId: sessionId, requestId: requestId)) ?? []
        currentRuns = runs.map {
            AgentRunDisplay(
                id: $0.id,
                agentName: $0.agentName,
                stepName: $0.stepName ?? $0.agentName,
                status: $0.status,
                summary: $0.summary,
                error: $0.error,
                orderIndex: $0.orderIndex ?? 0
            )
        }
        currentArtifacts = (try? chatRepo.listArtifacts(sessionId: sessionId, requestId: requestId)) ?? []
        currentPlan = []
    }

    private func agentGoal(_ agent: AgentType) -> String {
        switch agent {
        case .retrieval: return "检索相关知识库与论文"
        case .planner: return "规划研究路径与学习阶段"
        case .literatureScout: return "侦察相关文献与经典论文"
        case .survey: return "生成结构化文献综述"
        case .paperAnalyst: return "深度分析论文内容"
        case .reproduction: return "提供实验复现指导"
        case .synthesis: return "整合各模块产出最终答复"
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

    private func buildContextSummary(sessionId: String, userMessage: String, settings: AppSettings) -> String {
        var parts: [String] = []

        // Fetch session context
        if let session = try? chatRepo.dbQueue.read({ db in
            try ChatSession.fetchOne(db, sql: "SELECT * FROM chat_sessions WHERE id = ?", arguments: [sessionId])
        }) {
            if let contextType = session.contextType, let contextId = session.contextId {
                switch contextType {
                case "paper":
                    if let paper = try? paperRepo.get(id: contextId) {
                        parts.append("当前对话围绕论文《\(paper.title)》展开。")
                        if let abstract = paper.abstractText {
                            parts.append("论文摘要：\(abstract)")
                        }
                        if let analysis = paper.analysis {
                            var analysisParts: [String] = []
                            if let rq = analysis.researchQuestion { analysisParts.append("研究问题：\(rq)") }
                            if let cm = analysis.coreMethod { analysisParts.append("核心方法：\(cm)") }
                            if let ed = analysis.experimentDesign { analysisParts.append("实验设计：\(ed)") }
                            if let ic = analysis.innovations { analysisParts.append("创新点：\(ic)") }
                            if !analysisParts.isEmpty {
                                parts.append(analysisParts.joined(separator: "\n"))
                            }
                        }
                    }
                default:
                    break
                }
            }
        }

        // Memory context (last 3 memory events)
        if let memories = try? memoryRepo.recentObservations(hours: 72, limit: 3), !memories.isEmpty {
            let memoryText = memories.map { "- \($0.summary ?? "")" }.joined(separator: "\n")
            parts.append("近期研究记忆：\n\(memoryText)")
        }

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
