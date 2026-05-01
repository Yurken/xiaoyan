import Foundation

enum ChatRole {
    case user, assistant, system
}

enum ChatMode: String, Codable, CaseIterable {
    case direct, task

    var label: String {
        switch self {
        case .direct: return "直接对话"
        case .task: return "任务拆解"
        }
    }

    var description: String {
        switch self {
        case .direct: return "直接回答当前问题，不先拆很多步骤。"
        case .task: return "先拆任务，再按需调度检索和分析流程。"
        }
    }

    var inputPlaceholder: String {
        switch self {
        case .direct: return "直接问我就行，比如：你好、帮我润色这段话、解释一下这个概念"
        case .task: return "告诉我你的研究任务，我会先拆解步骤，再逐步推进"
        }
    }
}

struct ChatDisplayMessage: Identifiable {
    let id = UUID()
    let role: ChatRole
    var content: String
    var sources: [ChatSourceDisplay] = []
    var isStreaming: Bool = false
}

struct ChatSourceDisplay: Identifiable {
    let id = UUID()
    let title: String
    let score: Double
}
