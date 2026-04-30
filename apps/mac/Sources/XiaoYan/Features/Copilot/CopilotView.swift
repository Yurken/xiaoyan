import SwiftUI

struct CopilotView: View {
    @StateObject private var chatService = ChatService()
    @State private var inputText = ""
    @State private var messages: [ChatDisplayMessage] = []
    @State private var sessionId = UUID().uuidString

    var body: some View {
        HSplitView {
            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            if messages.isEmpty {
                                welcomeView
                            }
                            ForEach(messages) { message in
                                MessageBubbleView(message: message)
                                    .id(message.id)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _, _ in
                        if let last = messages.last {
                            withAnimation {
                                proxy.scrollTo(last.id, anchor: .bottom)
                            }
                        }
                    }
                }

                Divider()

                CopilotComposerView(inputText: $inputText, onSend: sendMessage)
                    .disabled(chatService.isStreaming)
            }
            .frame(minWidth: 500)

            CopilotSidebarView(activeAgents: chatService.activeAgents)
                .frame(minWidth: 260, maxWidth: 320)
        }
        .navigationTitle("小妍")
    }

    private var welcomeView: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)
            Text("你好！我是小妍")
                .font(.title2.bold())
            Text("你的 AI 学术研究助手")
                .foregroundStyle(.secondary)
            Text("我可以帮你阅读论文、撰写综述、规划研究方向")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }

    private func sendMessage() {
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        let userMsg = ChatDisplayMessage(role: .user, content: trimmed)
        messages.append(userMsg)
        inputText = ""

        // Create assistant message placeholder
        var assistantMsg = ChatDisplayMessage(role: .assistant, content: "")
        messages.append(assistantMsg)
        let assistantIndex = messages.count - 1

        Task {
            do {
                let settings = (try? await MainActor.run { () -> AppSettings in
                    // Access environment settings
                    fatalError("Settings must be injected")
                }) ?? AppSettings()

                let stream = chatService.chat(
                    sessionId: sessionId,
                    userMessage: trimmed,
                    settings: settings
                )

                for try await chunk in stream {
                    await MainActor.run {
                        messages[assistantIndex].content += chunk
                    }
                }

                await MainActor.run {
                    messages[assistantIndex].isStreaming = false
                }
            } catch {
                await MainActor.run {
                    messages[assistantIndex].content += "\n\n错误: \(error.localizedDescription)"
                    messages[assistantIndex].isStreaming = false
                }
            }
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
    var isStreaming: Bool = true
}

struct ChatSourceDisplay: Identifiable {
    let id = UUID()
    let title: String
    let score: Double
}

// Re-use MessageRole and ChatSource from CopilotView's original file
