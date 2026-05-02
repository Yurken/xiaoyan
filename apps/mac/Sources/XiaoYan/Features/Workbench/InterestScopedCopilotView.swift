import SwiftUI

struct InterestScopedCopilotView: View {
    let interestId: String
    @EnvironmentObject var settings: AppSettings
    @StateObject private var knowledgeService = KnowledgeService()
    @StateObject private var chatService = ChatService()
    @State private var sessions: [ChatSession] = []
    @State private var currentSessionId: String = UUID().uuidString
    @State private var skills: [Skill] = []
    private let chatRepo = ChatRepository()

    var scopedSessions: [ChatSession] {
        sessions.filter { $0.contextType == "interest" && $0.contextId == interestId }
    }

    var body: some View {
        VStack(spacing: 0) {
            sessionBar
            Divider()
            ChatThreadView(
                sessionId: currentSessionId,
                settings: settings,
                skills: skills,
                contextType: "interest",
                onUpdateSession: loadSessions,
                chatService: chatService
            )
            .id(currentSessionId)
        }
        .onAppear {
            loadSessions()
            loadSkills()
            ensureSessionExists()
        }
    }

    // MARK: - Session Bar

    private var sessionBar: some View {
        HStack(spacing: 12) {
            Text("会话")
                .font(.subheadline.bold())

            if !scopedSessions.isEmpty {
                Picker("选择会话", selection: $currentSessionId) {
                    ForEach(scopedSessions) { session in
                        Text(session.title ?? "新对话")
                            .tag(session.id)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)
                .labelsHidden()
            } else {
                Text("暂无会话")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: newChat) {
                Label("新建", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)

            if !scopedSessions.isEmpty {
                Button(action: deleteCurrentSession) {
                    Image(systemName: "trash")
                }
                .buttonStyle(.borderless)
                .foregroundStyle(.red)
                .help("删除当前会话")
            }
        }
        .padding()
    }

    // MARK: - Actions

    private func newChat() {
        let newId = UUID().uuidString
        currentSessionId = newId
        ensureSessionExists()
    }

    private func deleteCurrentSession() {
        try? chatRepo.deleteSession(id: currentSessionId)
        loadSessions()
        if scopedSessions.isEmpty {
            newChat()
        } else if let first = scopedSessions.first {
            currentSessionId = first.id
        }
    }

    private func ensureSessionExists() {
        let existing = sessions.first { $0.id == currentSessionId }
        if existing == nil {
            try? chatRepo.createSession(
                id: currentSessionId,
                title: "新对话",
                contextType: "interest",
                contextId: interestId
            )
            loadSessions()
        }
    }

    private func loadSessions() {
        sessions = (try? chatRepo.listSessions()) ?? []
    }

    private func loadSkills() {
        let dbSkills = (try? SkillRepository().list()) ?? []
        skills = dbSkills.isEmpty ? SkillService.builtInSkills : dbSkills
    }
}
