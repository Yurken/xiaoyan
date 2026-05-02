import SwiftUI

struct ChatThreadView: View {
    let sessionId: String
    let settings: AppSettings
    let skills: [Skill]
    let contextType: String?
    let onUpdateSession: () -> Void
    var showSidebarToggle: Bool = false
    var onToggleSidebar: (() -> Void)? = nil

    @ObservedObject var chatService: ChatService
    @StateObject private var attachmentManager = CopilotAttachmentManager()
    @State private var messages: [ChatDisplayMessage] = []
    @State private var inputText = ""
    @State private var selectedSkillId: String?
    @State private var activeAssistantId: UUID?
    @State private var activeStreamId: UUID?
    @State private var streamTask: Task<Void, Never>?
    private let chatRepo = ChatRepository()

    @AppStorage("rc_copilot_chat_mode") private var chatModeRaw: String = ChatMode.direct.rawValue

    private var chatMode: Binding<ChatMode> {
        Binding(
            get: { ChatMode(rawValue: chatModeRaw) ?? .direct },
            set: { chatModeRaw = $0.rawValue }
        )
    }

    var body: some View {
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
                chatMode: chatMode,
                attachmentManager: attachmentManager,
                selectedSkillId: $selectedSkillId,
                skills: skills,
                isStreaming: chatService.isStreaming,
                onSend: sendMessage,
                onStop: cancelActiveStream
            )
            .padding(8)
        }
        .onAppear {
            loadMessages()
            if let requestId = try? chatRepo.latestRequestId(sessionId: sessionId) {
                chatService.currentRequestId = requestId
                chatService.loadHistoricalRuns(sessionId: sessionId, requestId: requestId)
            } else {
                chatService.currentPlan = []
                chatService.currentRuns = []
                chatService.currentArtifacts = []
                chatService.currentRequestId = nil
            }
        }
        .onDisappear {
            cancelActiveStream()
        }
    }

    // MARK: - Header

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
                if let type = contextType {
                    TagBadge(
                        text: type == "interest" ? "研究方向上下文" : (type == "paper" ? "论文上下文" : "通用科研"),
                        color: .blue
                    )
                }
                TagBadge(
                    text: chatService.isStreaming ? "处理中" : "就绪",
                    color: chatService.isStreaming ? .orange : .green
                )
                if showSidebarToggle, let action = onToggleSidebar {
                    Button(action: action) {
                        Image(systemName: "sidebar.left")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
    }

    // MARK: - Welcome

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
        if contextType == "interest" {
            return [
                "帮我梳理这个方向的关键技术脉络",
                "这个领域有哪些值得关注的开放问题",
                "推荐几篇这个方向必读的经典论文",
            ]
        }
        if contextType == "paper" {
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
        let sid = sessionId
        activeStreamId = streamId

        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil

        streamTask = Task {
            let stream = chatService.chat(
                sessionId: sid,
                userMessage: finalContent,
                settings: settings,
                chatMode: ChatMode(rawValue: chatModeRaw)
            )

            do {
                for try await chunk in stream {
                    await MainActor.run {
                        guard activeStreamId == streamId else { return }
                        if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                            messages[index].content += chunk
                            messages[index].isStreaming = true
                        }
                    }
                }

                await MainActor.run {
                    guard activeStreamId == streamId else { return }
                    if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                        messages[index].isStreaming = false
                    }
                    activeAssistantId = nil
                    activeStreamId = nil
                    streamTask = nil
                    loadMessages()
                    onUpdateSession()
                }
            } catch {
                await MainActor.run {
                    guard activeStreamId == streamId else { return }
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

    private func loadMessages() {
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
