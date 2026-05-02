import SwiftUI

/// 版本详情/编辑面板：content 编辑 + AI 润色 + AI 审稿入口。
/// 1:1 desktop `VersionWorkspace.tsx:212-270`
struct VersionDetailSheet: View {
    let service: SubmissionService
    let submissionId: String
    @State var version: PaperVersion
    let onUpdated: () -> Void

    @EnvironmentObject var settings: AppSettings
    @Environment(\.dismiss) private var dismiss

    @State private var editedContent = ""
    @State private var editedNotes = ""
    @State private var isPolishing = false
    @State private var showAIReview = false

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    metadataSection
                    contentEditorSection
                    notesSection
                }
                .padding()
            }
            Divider()
            footer
        }
        .frame(width: 720, height: 620)
        .onAppear {
            editedContent = version.content ?? ""
            editedNotes = version.notes ?? ""
        }
        .sheet(isPresented: $showAIReview) {
            MockReviewSheet(
                service: service,
                submissionId: submissionId,
                prefilledContent: editedContent,
                onImported: { _ in onUpdated() }
            )
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.title3)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text(version.tag ?? "未命名版本")
                    .font(.headline)
                if let label = version.label {
                    Text(label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button(action: { dismiss() }) {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.borderless)
        }
        .padding()
    }

    // MARK: - Metadata

    private var metadataSection: some View {
        HStack(spacing: 16) {
            if let stage = version.stage {
                Text("阶段: \(SubmissionStatus(rawValue: stage)?.displayName ?? stage)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let date = version.createdAt {
                Text("创建于 \(date, style: .date)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    // MARK: - Content Editor

    private var contentEditorSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("正文内容")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Button(action: polishContent) {
                    Label("AI 润色", systemImage: "sparkles")
                }
                .font(.caption)
                .buttonStyle(.bordered)
                .controlSize(.small)
                .disabled(editedContent.trimmingCharacters(in: .whitespaces).isEmpty || isPolishing)
            }

            TextEditor(text: $editedContent)
                .font(.body)
                .frame(minHeight: 240)
                .padding(6)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)

            if isPolishing {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text("正在润色…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("备注")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            TextEditor(text: $editedNotes)
                .font(.body)
                .frame(minHeight: 80)
                .padding(6)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            Button("AI 审稿") {
                showAIReview = true
            }
            .font(.caption)
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(editedContent.trimmingCharacters(in: .whitespaces).isEmpty)

            Spacer()

            Button("取消") { dismiss() }
                .keyboardShortcut(.cancelAction)
            Button("保存") {
                save()
            }
            .keyboardShortcut(.defaultAction)
        }
        .padding()
    }

    // MARK: - Actions

    private func save() {
        var updated = version
        updated.content = editedContent
        updated.notes = editedNotes.isEmpty ? nil : editedNotes
        service.updateVersion(updated)
        onUpdated()
        dismiss()
    }

    private func polishContent() {
        let text = editedContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isPolishing = true

        Task {
            let client = LLMClient.fromSettings(
                settings,
                modelKeys: ["translation_model", "copilot_simple_model", "multi_agent_worker_model"],
                temperatureKeys: ["translation_temperature", "copilot_simple_temperature", "multi_agent_worker_temperature"]
            )
            guard let client else {
                isPolishing = false
                return
            }
            do {
                let polished = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: text)],
                    systemPrompt: "你是一位学术写作润色专家。请对以下论文内容进行语言润色，提升学术表达的准确性和流畅度，保持原意不变。直接返回润色后的文本，不要添加解释。"
                )
                await MainActor.run {
                    editedContent = polished
                    isPolishing = false
                }
            } catch {
                await MainActor.run {
                    isPolishing = false
                }
            }
        }
    }
}
