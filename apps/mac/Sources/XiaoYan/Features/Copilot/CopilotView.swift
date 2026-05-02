import SwiftUI

struct CopilotView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var chatService = ChatService()
    @StateObject private var knowledgeService = KnowledgeService()
    @State private var sessions: [ChatSession] = []
    @State private var interests: [ResearchInterest] = []
    @State private var currentSessionId: String = UUID().uuidString
    @State private var selectedInterestId: String = ""
    @State private var confirmDeleteGroupId: String?
    @State private var sessionToDelete: ChatSession?
    @State private var skills: [Skill] = []
    @State private var loadingSessions = true
    @State private var hideFolders = false
    @State private var missionControlExpanded = false

    private var chatRepo = ChatRepository()

    var body: some View {
        Group {
            if missionControlExpanded {
                MissionControlView(
                    plan: chatService.currentPlan,
                    runs: chatService.currentRuns,
                    artifacts: chatService.currentArtifacts,
                    requestId: chatService.currentRequestId,
                    sending: chatService.isStreaming,
                    isExpanded: true,
                    onSaveMemory: saveMemory,
                    onToggleExpand: { missionControlExpanded = false }
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onKeyPress(.escape) {
                    missionControlExpanded = false
                    return .handled
                }
            } else {
                HSplitView {
                    if !hideFolders {
                        sessionSidebar
                            .frame(minWidth: 200, maxWidth: 240)
                    }

                    ChatThreadView(
                        sessionId: currentSessionId,
                        settings: settings,
                        skills: skills,
                        contextType: sessions.first { $0.id == currentSessionId }?.contextType,
                        onUpdateSession: loadSessions,
                        showSidebarToggle: true,
                        onToggleSidebar: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                hideFolders.toggle()
                            }
                        },
                        chatService: chatService
                    )
                    .id(currentSessionId)
                    .frame(minWidth: 400)

                    MissionControlView(
                        plan: chatService.currentPlan,
                        runs: chatService.currentRuns,
                        artifacts: chatService.currentArtifacts,
                        requestId: chatService.currentRequestId,
                        sending: chatService.isStreaming,
                        isExpanded: false,
                        onSaveMemory: saveMemory,
                        onToggleExpand: { missionControlExpanded = true }
                    )
                    .frame(minWidth: 260, maxWidth: 320)
                }
            }
        }
        .navigationTitle("小妍")
        .onAppear {
            loadSessions()
            loadInterests()
            ensureSessionExists()
            consumePendingContext()
            loadSkills()
        }
        .onChange(of: settings.pendingChatContext) { _, newValue in
            if newValue != nil {
                consumePendingContext()
            }
        }
        .onDisappear {
            // ChatThreadView handles its own stream cancellation
        }
    }

    // MARK: - Session Grouping

    /// 未归类（无 interest 上下文 / 上下文非 interest 类型）的会话。
    private var ungroupedSessions: [ChatSession] {
        sessions.filter { $0.contextType != "interest" || ($0.contextId ?? "").isEmpty }
    }

    private func sessionsFor(interestId: String) -> [ChatSession] {
        sessions.filter { $0.contextType == "interest" && $0.contextId == interestId }
    }

    private func interestFolderName(_ interest: ResearchInterest) -> String {
        let trimmed = interest.folderName?.trimmingCharacters(in: .whitespaces) ?? ""
        return trimmed.isEmpty ? interest.topic : trimmed
    }

    // MARK: - Session Sidebar

    private var sessionSidebar: some View {
        VStack(spacing: 0) {
            HStack {
                Text("对话历史")
                    .font(.headline)
                Spacer()
                Button(action: newChat) {
                    Image(systemName: "plus")
                }
                .buttonStyle(.borderless)
                .help("新建对话")
            }
            .padding()

            if !interests.isEmpty {
                Picker("新对话主题", selection: $selectedInterestId) {
                    Text("未归类").tag("")
                    ForEach(interests) { interest in
                        Text(interestFolderName(interest)).tag(interest.id)
                    }
                }
                .pickerStyle(.menu)
                .controlSize(.small)
                .padding(.horizontal)
                .padding(.bottom, 8)
            }

            Divider()

            sessionListBody
        }
        .confirmationDialog("确认删除此对话？", isPresented: Binding(
            get: { sessionToDelete != nil },
            set: { if !$0 { sessionToDelete = nil } }
        ), titleVisibility: .visible) {
            Button("删除", role: .destructive) {
                if let session = sessionToDelete {
                    deleteSession(session)
                }
                sessionToDelete = nil
            }
            Button("取消", role: .cancel) {
                sessionToDelete = nil
            }
        } message: {
            Text("删除后无法恢复，该对话的所有消息将被清除。")
        }
    }

    @ViewBuilder
    private var sessionListBody: some View {
        if loadingSessions {
            ProgressView()
                .frame(maxWidth: .infinity, alignment: .center)
                .padding()
            Spacer()
        } else if sessions.isEmpty && interests.isEmpty {
            VStack(spacing: 8) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 24))
                    .foregroundStyle(.secondary)
                Text("暂无对话记录")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if !selectedInterestId.isEmpty {
            // 已选主题：只展示该主题下的会话
            let groupSessions = sessionsFor(interestId: selectedInterestId)
            if groupSessions.isEmpty {
                Text("该主题下暂无对话")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
                Spacer()
            } else {
                List {
                    ForEach(groupSessions) { session in
                        sessionRowItem(session)
                    }
                }
                .listStyle(.plain)
            }
        } else {
            // 未选主题：分组 + 未归类
            List {
                ForEach(interests) { interest in
                    let groupSessions = sessionsFor(interestId: interest.id)
                    if !groupSessions.isEmpty {
                        CopilotInterestSection(
                            interest: interest,
                            folderTitle: interestFolderName(interest),
                            sessions: groupSessions,
                            confirmDeleteId: $confirmDeleteGroupId,
                            onDeleteOnly: { deleteInterestGroup(interest.id, deleteAll: false) },
                            onDeleteAll: { deleteInterestGroup(interest.id, deleteAll: true) },
                            renderSession: { session in sessionRowItem(session) }
                        )
                    }
                }
                if !ungroupedSessions.isEmpty {
                    Section {
                        ForEach(ungroupedSessions) { session in
                            sessionRowItem(session)
                        }
                    } header: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("未归类")
                                .font(.caption.weight(.semibold))
                            Text("可右键移动到具体研究方向")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 1)
                    }
                }
            }
            .listStyle(.plain)
        }
    }

    @ViewBuilder
    private func sessionRowItem(_ session: ChatSession) -> some View {
        SessionRow(session: session, isActive: session.id == currentSessionId)
            .contentShape(Rectangle())
            .onTapGesture {
                switchSession(to: session)
            }
            .contextMenu {
                Section("移动到主题") {
                    Button("未归类") { moveSession(session, interestId: "") }
                    ForEach(interests) { interest in
                        Button(interestFolderName(interest)) {
                            moveSession(session, interestId: interest.id)
                        }
                    }
                }
                Divider()
                Button("删除", role: .destructive) {
                    sessionToDelete = session
                }
            }
    }

    // MARK: - Actions

    private func newChat() {
        let newId = UUID().uuidString
        currentSessionId = newId
        ensureSessionExists()
    }

    private func switchSession(to session: ChatSession) {
        currentSessionId = session.id
    }

    private func deleteSession(_ session: ChatSession) {
        try? chatRepo.deleteSession(id: session.id)
        if session.id == currentSessionId {
            newChat()
        }
        loadSessions()
    }

    private func moveSession(_ session: ChatSession, interestId: String) {
        let trimmed = interestId.trimmingCharacters(in: .whitespaces)
        let contextType: String? = trimmed.isEmpty ? nil : "interest"
        let contextId: String? = trimmed.isEmpty ? nil : trimmed
        try? chatRepo.updateSessionContext(id: session.id, contextType: contextType, contextId: contextId)
        loadSessions()
    }

    private func deleteInterestGroup(_ interestId: String, deleteAll: Bool) {
        let groupSessions = sessionsFor(interestId: interestId)
        let containsCurrent = groupSessions.contains { $0.id == currentSessionId }
        if deleteAll {
            for session in groupSessions {
                try? chatRepo.deleteSession(id: session.id)
            }
        } else {
            for session in groupSessions {
                try? chatRepo.updateSessionContext(id: session.id, contextType: nil, contextId: nil)
            }
        }
        confirmDeleteGroupId = nil
        if containsCurrent && deleteAll {
            newChat()
        }
        loadSessions()
    }

    // MARK: - Helpers

    private func ensureSessionExists() {
        let existing = sessions.first { $0.id == currentSessionId }
        if existing == nil {
            try? chatRepo.createSession(id: currentSessionId, title: "新对话", contextType: nil, contextId: nil)
            loadSessions()
        }
    }

    private func consumePendingContext() {
        guard let context = settings.pendingChatContext else { return }
        settings.pendingChatContext = nil

        let newId = UUID().uuidString
        currentSessionId = newId

        try? chatRepo.createSession(
            id: newId,
            title: "【论文】\(context.title)",
            contextType: context.type,
            contextId: context.id
        )
        loadSessions()

        let hint = "当前对话上下文：论文《\(context.title)》。你可以问关于这篇论文的任何问题。"
        let hintMsg = ChatMessage(
            id: UUID().uuidString,
            sessionId: newId,
            role: "assistant",
            content: hint,
            sources: nil,
            createdAt: Date()
        )
        try? chatRepo.insertMessage(hintMsg)
    }

    private func loadSessions() {
        loadingSessions = true
        sessions = (try? chatRepo.listSessions()) ?? []
        loadingSessions = false
    }

    private func loadInterests() {
        interests = knowledgeService.listInterests()
    }

    private func loadSkills() {
        let dbSkills = (try? SkillRepository().list()) ?? []
        skills = dbSkills.isEmpty ? SkillService.builtInSkills : dbSkills
    }

    private func saveMemory(text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let memory = UserMemory(
            id: UUID().uuidString,
            type: "manual",
            action: nil,
            summary: text,
            detail: nil,
            createdAt: Date()
        )
        try? MemoryRepository().insertMemory(memory)
    }
}

// MARK: - Session Row

private struct SessionRow: View {
    let session: ChatSession
    let isActive: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "bubble.left")
                .font(.caption)
                .foregroundStyle(isActive ? .white : .secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(session.title ?? "新对话")
                    .font(.subheadline)
                    .lineLimit(1)
                    .foregroundStyle(isActive ? .white : .primary)
                if let date = session.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(isActive ? .white.opacity(0.7) : .secondary)
                }
            }

            Spacer()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(isActive ? Color.accentColor : Color.clear)
        .cornerRadius(8)
    }
}

// MARK: - Copilot Interest Section（按研究方向分组的会话折叠面板）
// 1:1 desktop `apps/desktop/src/pages/Copilot.tsx:538-645`：
// 折叠头显示 folderName→topic、计数、二段确认（"仅置为未归类" / "删除全部" / 取消）

private struct CopilotInterestSection<Content: View>: View {
    let interest: ResearchInterest
    let folderTitle: String
    let sessions: [ChatSession]
    @Binding var confirmDeleteId: String?
    let onDeleteOnly: () -> Void
    let onDeleteAll: () -> Void
    let renderSession: (ChatSession) -> Content
    @State private var isExpanded: Bool = true

    private var isConfirming: Bool { confirmDeleteId == interest.id }

    var body: some View {
        DisclosureGroup(isExpanded: $isExpanded) {
            ForEach(sessions) { session in
                renderSession(session)
            }
        } label: {
            HStack(spacing: 6) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(folderTitle)
                        .font(.caption.weight(.semibold))
                        .lineLimit(1)
                    if folderTitle != interest.topic {
                        Text("研究主题:\(interest.topic)")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text("\(sessions.count) 条")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if isConfirming {
                    Button("仅置为未归类") { onDeleteOnly() }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                        .font(.caption2)
                    Button("删除全部", role: .destructive) { onDeleteAll() }
                        .buttonStyle(.borderless)
                        .controlSize(.mini)
                        .font(.caption2)
                    Button {
                        confirmDeleteId = nil
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.borderless)
                } else {
                    Button {
                        confirmDeleteId = interest.id
                    } label: {
                        Image(systemName: "trash")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.borderless)
                    .help("移除分组")
                }
            }
            .padding(.vertical, 1)
        }
    }
}
