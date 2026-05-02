import SwiftUI

struct CopilotView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var chatService = ChatService()
    @StateObject private var attachmentManager = CopilotAttachmentManager()
    @StateObject private var knowledgeService = KnowledgeService()
    @State private var sessions: [ChatSession] = []
    @State private var interests: [ResearchInterest] = []
    @State private var currentSessionId: String = UUID().uuidString
    @State private var messages: [ChatDisplayMessage] = []
    @State private var inputText = ""
    @State private var selectedInterestId: String = ""
    @State private var confirmDeleteGroupId: String?
    @AppStorage("rc_copilot_chat_mode") private var chatModeRaw: String = ChatMode.direct.rawValue
    @State private var skills: [Skill] = []
    @State private var selectedSkillId: String?
    @State private var activeAssistantId: UUID?
    @State private var activeStreamId: UUID?
    @State private var streamTask: Task<Void, Never>?
    @State private var loadingSessions = true

    private var chatRepo = ChatRepository()

    private var chatModeBinding: Binding<ChatMode> {
        Binding(
            get: { ChatMode(rawValue: chatModeRaw) ?? .direct },
            set: { chatModeRaw = $0.rawValue }
        )
    }

    var body: some View {
        HSplitView {
            sessionSidebar
                .frame(minWidth: 200, maxWidth: 240)

            chatArea
                .frame(minWidth: 400)

            MissionControlView(
                plan: chatService.currentPlan,
                runs: chatService.currentRuns,
                artifacts: chatService.currentArtifacts,
                requestId: chatService.currentRequestId,
                sending: chatService.isStreaming,
                onSaveMemory: saveMemory
            )
            .frame(minWidth: 260, maxWidth: 320)
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
            cancelActiveStream()
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
                    deleteSession(session)
                }
            }
    }

    // MARK: - Chat Area

    private var chatArea: some View {
        VStack(spacing: 0) {
            chatHeader

            Divider()

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 16) {
                        if messages.isEmpty {
                            welcomeView
                        }
                        ForEach(messages) { message in
                            MessageBubbleView(
                                message: message,
                                plan: activePlanFor(message: message),
                                runs: activeRunsFor(message: message)
                            )
                            .id(message.id)
                        }
                    }
                    .padding()
                }
                .onChange(of: messages.count) { _, _ in
                    scrollToBottom(proxy: proxy)
                }
                .onChange(of: messages.last?.content) { _, _ in
                    scrollToBottom(proxy: proxy)
                }
            }

            if let error = chatService.streamError, !error.isEmpty {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color.red.opacity(0.08))
            }

            Divider()

            CopilotComposerView(
                inputText: $inputText,
                chatMode: chatModeBinding,
                attachmentManager: attachmentManager,
                selectedSkillId: $selectedSkillId,
                skills: skills,
                onSend: sendMessage
            )
                .disabled(chatService.isStreaming)
                .padding(8)
        }
    }

    private var chatHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("小妍对话")
                    .font(.headline)
                Text(chatService.isStreaming ? "编排中..." : "就绪")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            HStack(spacing: 6) {
                let isPaperContext = sessions.first { $0.id == currentSessionId }?.contextType == "paper"
                TagBadge(text: isPaperContext ? "论文上下文" : "通用科研", color: .blue)
                TagBadge(
                    text: chatService.isStreaming ? "处理中" : "就绪",
                    color: chatService.isStreaming ? .orange : .green
                )
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }

    private var welcomeView: some View {
        VStack(spacing: 20) {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 40))
                    .foregroundStyle(.orange)
                Text("你好！我是小妍")
                    .font(.title2.bold())
                Text("你的 AI 学术研究助手，陪你从选题到沉淀")
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                ForEach(welcomeSuggestions, id: \.self) { suggestion in
                    Button(action: {
                        inputText = suggestion
                    }) {
                        HStack {
                            Text(suggestion)
                                .font(.subheadline)
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                            Spacer()
                            Image(systemName: "arrow.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Theme.Colors.surface)
                        .cornerRadius(Theme.Radii.medium)
                        .nmShadow(level: Theme.Shadows.soft)
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 500)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    private var welcomeSuggestions: [String] {
        let isPaperContext = sessions.first { $0.id == currentSessionId }?.contextType == "paper"
        if isPaperContext {
            return [
                "总结这篇论文的核心创新点和局限",
                "给出这篇论文的复现实验建议",
                "这篇论文最关键的实验设计是什么",
            ]
        }
        return [
            "帮我规划多模态检索方向的学习路径",
            "帮我做一个关于图神经网络的文献综述切入点",
            "围绕知识图谱问答，列出值得先读的几篇论文",
        ]
    }

    // MARK: - Actions

    private func newChat() {
        cancelActiveStream()
        let newId = UUID().uuidString
        currentSessionId = newId
        messages = []
        activeAssistantId = nil
        attachmentManager.clear()
        selectedSkillId = nil
        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil
        ensureSessionExists()
    }

    private func switchSession(to session: ChatSession) {
        cancelActiveStream()
        currentSessionId = session.id
        loadMessages(for: session.id)
        activeAssistantId = nil
        attachmentManager.clear()
        selectedSkillId = nil
        chatService.streamError = nil
        // Recover latest agent runs if any
        if let requestId = try? chatRepo.latestRequestId(sessionId: session.id) {
            chatService.currentRequestId = requestId
            chatService.loadHistoricalRuns(sessionId: session.id, requestId: requestId)
        } else {
            chatService.currentPlan = []
            chatService.currentRuns = []
            chatService.currentArtifacts = []
            chatService.currentRequestId = nil
        }
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

    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasAttachments = !attachmentManager.pending.isEmpty
        guard (hasAttachments || !trimmed.isEmpty), !chatService.isStreaming else { return }

        let baseText = trimmed.isEmpty ? "请阅读上传的文件并回答。" : trimmed
        let withSkill: String
        if let id = selectedSkillId, let skill = skills.first(where: { $0.id == id }) {
            withSkill = "[技能指令 · \(skill.title)]\n\(skill.prompt)\n\n---\n\n\(baseText)"
        } else {
            withSkill = baseText
        }
        let attachments = attachmentManager.pending
        let finalContent = buildCopilotMessageContent(text: withSkill, attachments: attachments)

        ensureSessionExists()
        streamTask?.cancel()

        let userMsg = ChatDisplayMessage(role: .user, content: finalContent)
        messages.append(userMsg)
        inputText = ""
        attachmentManager.clear()

        let assistantMsg = ChatDisplayMessage(role: .assistant, content: "")
        let assistantId = assistantMsg.id
        messages.append(assistantMsg)
        activeAssistantId = assistantId
        let streamId = UUID()
        let sessionId = currentSessionId
        activeStreamId = streamId

        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil

        streamTask = Task {
            let stream = chatService.chat(
                sessionId: sessionId,
                userMessage: finalContent,
                settings: settings,
                chatMode: ChatMode(rawValue: chatModeRaw)
            )

            do {
                for try await chunk in stream {
                    await MainActor.run {
                        guard activeStreamId == streamId, currentSessionId == sessionId else { return }
                        if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                            messages[index].content += chunk
                            messages[index].isStreaming = true
                        }
                    }
                }

                await MainActor.run {
                    guard activeStreamId == streamId, currentSessionId == sessionId else { return }
                    if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                        messages[index].isStreaming = false
                    }
                    activeAssistantId = nil
                    activeStreamId = nil
                    streamTask = nil
                    loadMessages(for: sessionId)
                    loadSessions()
                }
            } catch {
                await MainActor.run {
                    guard activeStreamId == streamId, currentSessionId == sessionId else { return }
                    if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                        messages[index].content += "\n\n错误: \(error.localizedDescription)"
                        messages[index].isStreaming = false
                    }
                    activeAssistantId = nil
                    activeStreamId = nil
                    streamTask = nil
                }
            }
        }
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
        cancelActiveStream()
        settings.pendingChatContext = nil

        let newId = UUID().uuidString
        currentSessionId = newId
        messages = []
        activeAssistantId = nil
        attachmentManager.clear()
        selectedSkillId = nil
        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil

        try? chatRepo.createSession(
            id: newId,
            title: "【论文】\(context.title)",
            contextType: context.type,
            contextId: context.id
        )
        loadSessions()

        let hint = "当前对话上下文：论文《\(context.title)》。你可以问关于这篇论文的任何问题。"
        messages.append(ChatDisplayMessage(role: .assistant, content: hint))
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

    private func loadMessages(for sessionId: String) {
        let history = (try? chatRepo.fetchHistory(sessionId: sessionId, limit: 100)) ?? []
        messages = history.reversed().map { msg in
            ChatDisplayMessage(
                role: msg.role == "user" ? .user : .assistant,
                content: msg.content,
                sources: msg.sources?.map { ChatSourceDisplay(title: $0.title, score: $0.score) } ?? []
            )
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        if let last = messages.last {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }

    private func activePlanFor(message: ChatDisplayMessage) -> [AgentPlanStep] {
        guard message.role == .assistant, message.id == activeAssistantId else { return [] }
        return chatService.currentPlan
    }

    private func activeRunsFor(message: ChatDisplayMessage) -> [AgentRunDisplay] {
        guard message.role == .assistant, message.id == activeAssistantId else { return [] }
        return chatService.currentRuns
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

    private func cancelActiveStream() {
        streamTask?.cancel()
        streamTask = nil
        activeStreamId = nil
        activeAssistantId = nil
        chatService.streamError = nil
        if let index = messages.firstIndex(where: { $0.isStreaming }) {
            messages[index].isStreaming = false
        }
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
