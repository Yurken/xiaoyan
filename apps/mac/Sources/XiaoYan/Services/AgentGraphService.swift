import Foundation

/// DAG-based multi-agent orchestration
@MainActor
final class AgentGraphService: ObservableObject {
    @Published var activeAgents: [AgentNodeState] = []
    @Published var completedAgents: [AgentNodeState] = []

    struct AgentNodeState: Identifiable {
        let id: String
        let agentName: String
        let stepName: String
        var status: AgentStatus
        var summary: String?
    }

    /// Select which agents to activate based on routing mode and user query
    static func selectAgents(
        query: String,
        routingMode: String,
        enabledAgents: [String],
        settings: AppSettings
    ) -> [AgentType] {
        var selected: Set<AgentType> = []

        // Always include retrieval
        selected.insert(.retrieval)

        switch routingMode {
        case "rule":
            selected.formUnion(ruleBasedSelection(query: query, settings: settings))
        case "llm":
            // LLM-based selection would call supervisor model
            // For now, fall back to rule-based
            selected.formUnion(ruleBasedSelection(query: query, settings: settings))
        case "hybrid":
            selected.formUnion(ruleBasedSelection(query: query, settings: settings))
            // Merge with LLM-based if available
        default:
            break
        }

        // Filter by enabled agents
        return selected.filter { agent in
            enabledAgents.contains(where: { $0 == agent.rawValue })
        }
    }

    private static func ruleBasedSelection(query: String, settings: AppSettings) -> [AgentType] {
        var agents: [AgentType] = []
        let q = query.lowercased()

        // Planner keywords
        let plannerKeywords = (settings.get("agent_routing_keywords_planner") ?? "").components(separatedBy: ",")
        if plannerKeywords.contains(where: { q.contains($0.trimmingCharacters(in: .whitespaces).lowercased()) }) {
            agents.append(.planner)
        }

        // Literature scout keywords
        let scoutKeywords = (settings.get("agent_routing_keywords_literature_scout") ?? "").components(separatedBy: ",")
        if scoutKeywords.contains(where: { q.contains($0.trimmingCharacters(in: .whitespaces).lowercased()) }) {
            agents.append(.literatureScout)
        }

        // Survey keywords
        let surveyKeywords = (settings.get("agent_routing_keywords_survey") ?? "").components(separatedBy: ",")
        if surveyKeywords.contains(where: { q.contains($0.trimmingCharacters(in: .whitespaces).lowercased()) }) {
            agents.append(.survey)
        }

        // Paper analyst keywords
        let analystKeywords = (settings.get("agent_routing_keywords_paper_analyst") ?? "").components(separatedBy: ",")
        if analystKeywords.contains(where: { q.contains($0.trimmingCharacters(in: .whitespaces).lowercased()) }) {
            agents.append(.paperAnalyst)
        }

        // Reproduction keywords
        let reproKeywords = (settings.get("agent_routing_keywords_reproduction") ?? "").components(separatedBy: ",")
        if reproKeywords.contains(where: { q.contains($0.trimmingCharacters(in: .whitespaces).lowercased()) }) {
            agents.append(.reproduction)
        }

        // Default: if no specific agent selected, use survey
        if agents.isEmpty {
            agents.append(.survey)
        }

        return agents
    }
}
