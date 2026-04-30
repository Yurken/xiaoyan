import Foundation

enum ChatRole {
    case user, assistant, system
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
