import SwiftUI

struct CopilotView: View {
    @EnvironmentObject var settings: AppSettings
    @StateObject private var chatService = ChatService()
    @State private var sessions: [ChatSession] = []
    @State private var currentSessionId: String = UUID().uuidString
    @State private var messages: [ChatDisplayMessage] = []
    @State private var inputText = ""
    @State private var activeAssistantId: UUID?
    @State private var loadingSessions = true

    private var chatRepo = ChatRepository()

    var body: some View {
        HSplitView {
            // MARK: - Session Sidebar
            sessionSidebar
                .frame(minWidth: 200, maxWidth: 240)

            // MARK: - Chat Area
            chatArea
                .frame(minWidth: 400)

            // MARK: - Mission Control
            MissionControlView(
                plan: chatService.currentPlan,
                runs: chatService.currentRuns,
                artifacts: chatService.currentArtifacts,
                requestId: chatService.currentRequestId,
                sending: chatService.isStreaming
            )
            .frame(minWidth: 260, maxWidth: 320)
        }
        .navigationTitle("小妍")
        .onAppear {
            loadSessions()
            ensureSessionExists()
            consumePendingContext()
        }
        .onChange(of: settings.pendingChatContext) { _, newValue in
            if newValue != nil {
                consumePendingContext()
            }
        }
    }

    // MARK: - Session Sidebar

    private var sessionSidebar: some View {
        VStack(spacing: 0) {
            // Header
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

            Divider()

            // Session List
            List {
                if loadingSessions {
                    ProgressView()
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else if sessions.isEmpty {
                    Text("暂无对话记录")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding()
                } else {
                    ForEach(sessions) { session in
                        SessionRow(
                            session: session,
                            isActive: session.id == currentSessionId
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            switchSession(to: session)
                        }
                        .contextMenu {
                            Button("删除", role: .destructive) {
                                deleteSession(session)
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
        }
    }

    // MARK: - Chat Area

    private var chatArea: some View {
        VStack(spacing: 0) {
            // Header
            chatHeader

            Divider()

            // Messages
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

            // Error banner
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

            // Composer
            CopilotComposerView(inputText: $inputText, onSend: sendMessage)
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
                StatusBadge(text: isPaperContext ? "论文上下文" : "通用科研", color: .blue)
                StatusBadge(
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
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(10)
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
        let newId = UUID().uuidString
        currentSessionId = newId
        messages = []
        activeAssistantId = nil
        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil
        ensureSessionExists()
    }

    private func switchSession(to session: ChatSession) {
        currentSessionId = session.id
        loadMessages(for: session.id)
        activeAssistantId = nil
        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil
    }

    private func deleteSession(_ session: ChatSession) {
        try? chatRepo.deleteSession(id: session.id)
        if session.id == currentSessionId {
            newChat()
        }
        loadSessions()
    }

    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !chatService.isStreaming else { return }

        ensureSessionExists()

        let userMsg = ChatDisplayMessage(role: .user, content: trimmed)
        messages.append(userMsg)
        inputText = ""

        let assistantId = UUID()
        let assistantMsg = ChatDisplayMessage(role: .assistant, content: "")
        messages.append(assistantMsg)
        activeAssistantId = assistantId

        // Clear previous mission control state for new request
        chatService.currentPlan = []
        chatService.currentRuns = []
        chatService.currentArtifacts = []
        chatService.currentRequestId = nil
        chatService.streamError = nil

        Task {
            let stream = chatService.chat(
                sessionId: currentSessionId,
                userMessage: trimmed,
                settings: settings
            )

            do {
                for try await chunk in stream {
                    await MainActor.run {
                        if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                            messages[index].content += chunk
                            messages[index].isStreaming = true
                        }
                    }
                }

                await MainActor.run {
                    if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                        messages[index].isStreaming = false
                    }
                    activeAssistantId = nil
                    loadMessages(for: currentSessionId)
                    loadSessions()
                }
            } catch {
                await MainActor.run {
                    if let index = messages.firstIndex(where: { $0.id == assistantId }) {
                        messages[index].content += "\n\n错误: \(error.localizedDescription)"
                        messages[index].isStreaming = false
                    }
                    activeAssistantId = nil
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
        settings.pendingChatContext = nil

        // Create a new session with context
        let newId = UUID().uuidString
        currentSessionId = newId
        messages = []
        activeAssistantId = nil
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

        // Add a system hint message
        let hint = "当前对话上下文：论文《\(context.title)》。你可以问关于这篇论文的任何问题。"
        messages.append(ChatDisplayMessage(role: .assistant, content: hint))
    }

    private func loadSessions() {
        loadingSessions = true
        sessions = (try? chatRepo.listSessions()) ?? []
        loadingSessions = false
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

// MARK: - Status Badge

private struct StatusBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundColor(color)
            .cornerRadius(6)
    }
}

// MARK: - Mission Control

struct MissionControlView: View {
    let plan: [AgentPlanStep]
    let runs: [AgentRunDisplay]
    let artifacts: [AgentArtifact]
    let requestId: String?
    let sending: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("执行总览")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Text("调度视图")
                        .font(.headline)
                }
                Spacer()
                StatusBadge(text: sending ? "处理中" : "就绪", color: sending ? .orange : .green)
            }
            .padding(.horizontal)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let reqId = requestId {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("请求 ID")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Text(reqId)
                                .font(.system(.caption, design: .monospaced))
                                .lineLimit(1)
                                .truncationMode(.tail)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }

                    // Plan
                    planSection

                    // Runs
                    runsSection

                    // Artifacts
                    artifactsSection
                }
                .padding(.horizontal)
                .padding(.bottom)
            }
        }
        .padding(.top)
    }

    private var planSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "radar")
                    .font(.caption)
                    .foregroundStyle(.blue)
                Text("计划分解")
                    .font(.subheadline.bold())
            }

            if plan.isEmpty {
                Text("发送问题后，小妍会在此展示任务拆解和执行链路。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(plan) { step in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(step.title)
                                    .font(.caption.bold())
                                Spacer()
                                Text(capabilityName(step.agentName))
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.1))
                                    .cornerRadius(4)
                            }
                            Text(step.goal)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(8)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }
                }
            }
        }
    }

    private var runsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "cpu")
                    .font(.caption)
                    .foregroundStyle(.orange)
                Text("能力域模型执行")
                    .font(.subheadline.bold())
            }

            if runs.isEmpty {
                Text("暂无分析模型运行记录。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(runs.sorted(by: { $0.orderIndex < $1.orderIndex })) { run in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(run.stepName)
                                        .font(.caption.bold())
                                    Text(capabilityName(run.agentName))
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                RunStatusBadge(status: run.status)
                            }
                            if let summary = run.summary {
                                Text(summary)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                            if let error = run.error {
                                Text(error)
                                    .font(.caption2)
                                    .foregroundStyle(.red)
                            }
                        }
                        .padding(8)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }
                }
            }
        }
    }

    private var artifactsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "sparkles")
                    .font(.caption)
                    .foregroundStyle(.purple)
                Text("结构化产物")
                    .font(.subheadline.bold())
            }

            if artifacts.isEmpty {
                Text("暂无结构化产物，模型产出后将出现在这里。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(artifacts.prefix(4)) { artifact in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(artifact.title ?? artifact.artifactType)
                                .font(.caption.bold())
                            if let content = artifact.content {
                                Text(content)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(5)
                            }
                        }
                        .padding(8)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }
                }
            }
        }
    }

    private func capabilityName(_ raw: String) -> String {
        switch raw {
        case "retrieval": return "检索模型"
        case "planner": return "谋策模型"
        case "literature_scout": return "探知模型"
        case "survey": return "翰章模型"
        case "paper_analyst": return "洞见模型"
        case "reproduction": return "构域模型"
        case "synthesis": return "整合模型"
        default: return raw
        }
    }
}

private struct RunStatusBadge: View {
    let status: AgentStatus

    var body: some View {
        HStack(spacing: 2) {
            Image(systemName: statusIcon)
                .font(.caption2)
            Text(statusLabel)
                .font(.caption2.bold())
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(statusColor.opacity(0.15))
        .foregroundColor(statusColor)
        .cornerRadius(4)
    }

    private var statusIcon: String {
        switch status {
        case .done: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .running: return "clock.fill"
        case .pending: return "clock"
        }
    }

    private var statusLabel: String {
        switch status {
        case .done: return "已完成"
        case .failed: return "失败"
        case .running: return "处理中"
        case .pending: return "待处理"
        }
    }

    private var statusColor: Color {
        switch status {
        case .done: return .green
        case .failed: return .red
        case .running: return .orange
        case .pending: return .secondary
        }
    }
}

// MARK: - Display Models

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
