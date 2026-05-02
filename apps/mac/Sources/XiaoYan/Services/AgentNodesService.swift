import Foundation

/// Specialized worker agents for the DAG pipeline
struct AgentNodesService {

    struct AgentResult {
        let content: String
        let sources: [[String: Any]]?
    }

    // MARK: - Retrieval Agent

    static func retrievalNode(
        query: String,
        settings: [String: String],
        paperRepo: PaperRepository,
        knowledgeRepo: KnowledgeRepository
    ) async -> AgentResult {
        guard let embedClient = EmbeddingClient.fromSettings(settings) else {
            return AgentResult(content: "", sources: nil)
        }

        do {
            let queryEmbedding = try await embedClient.embed(text: query)
            let results = RAGService.combinedSearch(
                queryEmbedding: queryEmbedding,
                paperRepo: paperRepo,
                knowledgeRepo: knowledgeRepo
            )

            var contextParts: [String] = []
            var sources: [[String: Any]] = []

            for result in results {
                contextParts.append(result.content)
                sources.append([
                    "id": result.id,
                    "title": String(result.content.prefix(80)),
                    "score": result.score,
                    "type": result.source == .paper ? "paper" : "note"
                ])
            }

            // Graph RAG
            if settings["graph_rag_enabled"] == "true" {
                let claims = GraphRAGService.searchClaimProvenance(
                    queryEmbedding: queryEmbedding,
                    dbQueue: DatabaseManager.shared.dbQueue
                )
                let graphContext = GraphRAGService.buildGraphRAGContext(claims: claims)
                if !graphContext.isEmpty {
                    contextParts.append(graphContext)
                }
            }

            return AgentResult(
                content: contextParts.joined(separator: "\n\n"),
                sources: sources.isEmpty ? nil : sources
            )
        } catch {
            return AgentResult(content: "检索失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Survey Agent

    static func surveyNode(
        query: String,
        context: String,
        settings: [String: String]
    ) async -> AgentResult {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["survey_writer_model", "multi_agent_survey_model", "multi_agent_worker_model"],
            temperatureKeys: ["survey_writer_temperature", "multi_agent_survey_temperature", "multi_agent_worker_temperature"]
        ) else {
            return AgentResult(content: "未配置 Survey Agent 模型", sources: nil)
        }

        let prompt = """
        你是一位文献综述专家。基于以下研究背景，为用户提供结构化的文献综述分析。

        ## 研究背景
        \(context)

        ## 用户问题
        \(query)

        请按以下结构组织回复：
        1. 研究领域概述
        2. 关键研究方向
        3. 代表性工作
        4. 研究趋势
        5. 未来展望
        """

        do {
            let content = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: query)],
                systemPrompt: prompt
            )
            return AgentResult(content: content, sources: nil)
        } catch {
            return AgentResult(content: "综述生成失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Paper Analyst Agent

    static func paperAnalystNode(
        query: String,
        context: String,
        settings: [String: String]
    ) async -> AgentResult {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_paper_analyst_model", "multi_agent_worker_model"],
            temperatureKeys: ["multi_agent_paper_analyst_temperature", "multi_agent_worker_temperature"]
        ) else {
            return AgentResult(content: "未配置 Paper Analyst 模型", sources: nil)
        }

        let prompt = """
        你是一位资深论文分析专家。基于以下论文内容，提供深入的分析。

        ## 论文内容
        \(context)

        ## 分析请求
        \(query)

        请从以下维度分析：
        1. 研究问题与动机
        2. 核心方法与创新点
        3. 实验设计与结果
        4. 优势与局限性
        5. 关键结论与启示
        """

        do {
            let content = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: query)],
                systemPrompt: prompt
            )
            return AgentResult(content: content, sources: nil)
        } catch {
            return AgentResult(content: "论文分析失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Planner Agent

    static func plannerNode(
        query: String,
        context: String,
        settings: [String: String]
    ) async -> AgentResult {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["survey_planner_model", "multi_agent_planner_model", "multi_agent_worker_model"],
            temperatureKeys: ["survey_planner_temperature", "multi_agent_planner_temperature", "multi_agent_worker_temperature"]
        ) else {
            return AgentResult(content: "未配置 Planner Agent 模型", sources: nil)
        }

        let prompt = """
        你是一位研究规划师。基于用户的兴趣和背景，制定学习路径和研究规划。

        ## 背景信息
        \(context)

        ## 用户需求
        \(query)

        请提供：
        1. 研究方向建议
        2. 分阶段学习路径
        3. 推荐阅读材料
        4. 时间规划建议
        """

        do {
            let content = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: query)],
                systemPrompt: prompt
            )
            return AgentResult(content: content, sources: nil)
        } catch {
            return AgentResult(content: "规划生成失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Literature Scout Agent

    static func literatureScoutNode(
        query: String,
        context: String,
        settings: [String: String]
    ) async -> AgentResult {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_literature_scout_model", "multi_agent_worker_model"],
            temperatureKeys: ["multi_agent_literature_scout_temperature", "multi_agent_worker_temperature"]
        ) else {
            return AgentResult(content: "未配置 Literature Scout 模型", sources: nil)
        }

        let prompt = """
        你是一位文献推荐专家。基于用户的兴趣，推荐相关的学术论文和研究方向。

        ## 用户兴趣
        \(context)

        ## 推荐请求
        \(query)

        请推荐：
        1. 必读经典论文
        2. 最新前沿工作
        3. 相关研究方向
        4. 潜在合作机会
        """

        do {
            let content = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: query)],
                systemPrompt: prompt
            )
            return AgentResult(content: content, sources: nil)
        } catch {
            return AgentResult(content: "文献推荐失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Reproduction Agent

    static func reproductionNode(
        query: String,
        context: String,
        settings: [String: String]
    ) async -> AgentResult {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_reproduction_model", "multi_agent_worker_model"],
            temperatureKeys: ["multi_agent_reproduction_temperature", "multi_agent_worker_temperature"]
        ) else {
            return AgentResult(content: "未配置 Reproduction Agent 模型", sources: nil)
        }

        let prompt = """
        你是一位论文复现专家。基于论文内容，提供详细的复现指南。

        ## 论文内容
        \(context)

        ## 复现需求
        \(query)

        请提供：
        1. 环境配置要求
        2. 数据准备指南
        3. 分步复现流程
        4. 预期结果对比
        5. 常见问题与解决方案
        """

        do {
            let content = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: query)],
                systemPrompt: prompt
            )
            return AgentResult(content: content, sources: nil)
        } catch {
            return AgentResult(content: "复现指南生成失败: \(error.localizedDescription)", sources: nil)
        }
    }

    // MARK: - Synthesis Agent

    static func synthesisNode(
        query: String,
        contextParts: [String],
        settings: [String: String]
    ) -> AsyncThrowingStream<String, Error> {
        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["multi_agent_synthesis_model", "copilot_simple_model"],
            temperatureKeys: ["multi_agent_synthesis_temperature"]
        ) else {
            return AsyncThrowingStream { continuation in
                continuation.yield("未配置 Synthesis Agent 模型")
                continuation.finish()
            }
        }

        let combinedContext = contextParts.joined(separator: "\n\n---\n\n")
        let prompt = """
        你是小妍，一个专业的 AI 研究助手。综合以下多个来源的信息，为用户提供全面、准确的回答。

        ## 参考信息
        \(combinedContext)

        请用中文回答，确保：
        1. 综合所有来源的信息
        2. 引用具体的研究和数据
        3. 提供清晰的结构
        4. 标注信息来源
        """

        return client.streamChat(
            messages: [LLMClient.Message(role: "user", content: query)],
            systemPrompt: prompt
        )
    }
}
