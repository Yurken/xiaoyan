import SwiftUI
import UniformTypeIdentifiers

struct CopilotComposerView: View {
    @Binding var inputText: String
    @Binding var chatMode: ChatMode
    @ObservedObject var attachmentManager: CopilotAttachmentManager
    @Binding var selectedSkillId: String?
    let skills: [Skill]
    var onSend: () -> Void

    @State private var showingFileImporter = false
    @State private var showingSkillsPopover = false

    private var selectedSkill: Skill? {
        guard let id = selectedSkillId else { return nil }
        return skills.first { $0.id == id }
    }

    private var enabledSkills: [Skill] {
        skills.filter { ($0.isEnabled ?? true) && $0.name != "ppt-generate" }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            modeRow
            if !attachmentManager.pending.isEmpty {
                attachmentChipsRow
            }
            if let lastError = attachmentManager.lastError, !lastError.isEmpty {
                Text(lastError)
                    .font(.caption2)
                    .foregroundStyle(.red)
            }
            if let skill = selectedSkill {
                selectedSkillBanner(skill)
            }
            inputRow
        }
        .fileImporter(
            isPresented: $showingFileImporter,
            allowedContentTypes: allowedFileTypes,
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                Task { await attachmentManager.add(urls: urls) }
            }
        }
    }

    private var modeRow: some View {
        HStack(spacing: 6) {
            ForEach(ChatMode.allCases, id: \.self) { mode in
                Button {
                    chatMode = mode
                } label: {
                    Text(mode.label)
                        .font(.caption.weight(chatMode == mode ? .semibold : .regular))
                        .foregroundStyle(chatMode == mode ? Color.white : Color.primary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(chatMode == mode ? Color.accentColor : Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                        )
                        .cornerRadius(6)
                }
                .buttonStyle(.plain)
                .help(mode.description)
            }
            Spacer()
            Text(chatMode.description)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private var attachmentChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(attachmentManager.pending) { attachment in
                    HStack(spacing: 4) {
                        Image(systemName: attachment.extension == "pdf" ? "doc.richtext" : "doc.plaintext")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(attachment.name)
                            .font(.caption2)
                            .lineLimit(1)
                            .truncationMode(.middle)
                            .frame(maxWidth: 180)
                        Button {
                            attachmentManager.remove(id: attachment.id)
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.12))
                    .cornerRadius(8)
                }
                if attachmentManager.isUploading {
                    HStack(spacing: 4) {
                        ProgressView().controlSize(.mini)
                        Text("解析中…")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                }
            }
        }
        .frame(maxHeight: 32)
    }

    private func selectedSkillBanner(_ skill: Skill) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "wand.and.stars")
                .foregroundStyle(.orange)
            Text("已选技能：")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(skill.title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.orange)
            Spacer()
            Button {
                selectedSkillId = nil
            } label: {
                Text("取消")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(Color.orange.opacity(0.08))
        .cornerRadius(6)
    }

    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: 8) {
            VStack(spacing: 4) {
                ZStack(alignment: .topLeading) {
                    if inputText.isEmpty {
                        Text(chatMode.inputPlaceholder)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 12)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $inputText)
                        .font(.body)
                        .lineLimit(1...6)
                        .scrollContentBackground(.hidden)
                        .padding(8)
                }
                toolBar
            }
            .background(Theme.Colors.surface)
            .cornerRadius(Theme.Radii.medium)
            .nmShadow(level: Theme.Shadows.soft)
            .frame(minHeight: 60, maxHeight: 160)

            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 28))
            }
            .buttonStyle(.plain)
            .disabled(canSend == false)
            .padding(.bottom, 4)
        }
    }

    private var toolBar: some View {
        HStack(spacing: 6) {
            Button {
                showingFileImporter = true
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "paperclip")
                    if !attachmentManager.pending.isEmpty {
                        Text("\(attachmentManager.pending.count)")
                            .font(.caption2.bold())
                    }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .disabled(attachmentManager.pending.count >= CopilotAttachmentManager.maxAttachments
                      || attachmentManager.isUploading)
            .help("添加附件（PDF / 文本，最多 \(CopilotAttachmentManager.maxAttachments) 个）")

            Button {
                showingSkillsPopover = true
            } label: {
                HStack(spacing: 3) {
                    Image(systemName: "wand.and.stars")
                    if let skill = selectedSkill {
                        Text(skill.title)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .foregroundStyle(selectedSkill != nil ? .orange : .secondary)
            }
            .buttonStyle(.plain)
            .help("选择技能")
            .popover(isPresented: $showingSkillsPopover, arrowEdge: .top) {
                SkillsPickerPopover(
                    skills: enabledSkills,
                    selectedSkillId: $selectedSkillId,
                    onClose: { showingSkillsPopover = false }
                )
            }

            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.bottom, 6)
    }

    private var allowedFileTypes: [UTType] {
        var types: [UTType] = [.pdf, .plainText]
        for ext in CopilotAttachmentManager.textExtensions {
            if let type = UTType(filenameExtension: ext) {
                types.append(type)
            }
        }
        return types
    }

    private var canSend: Bool {
        let hasText = !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasAttachments = !attachmentManager.pending.isEmpty
        return (hasText || hasAttachments) && !attachmentManager.isUploading
    }
}

// MARK: - Skills Picker Popover

private struct SkillsPickerPopover: View {
    let skills: [Skill]
    @Binding var selectedSkillId: String?
    var onClose: () -> Void

    @State private var hoverSkill: Skill?

    private var detailSkill: Skill? {
        hoverSkill ?? skills.first { $0.id == selectedSkillId } ?? skills.first
    }

    var body: some View {
        HStack(spacing: 0) {
            // Left list
            VStack(alignment: .leading, spacing: 0) {
                Text("内置技能")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.top, 12)
                    .padding(.bottom, 6)

                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(skills) { skill in
                            skillRow(skill)
                        }
                        if skills.isEmpty {
                            Text("没有可用技能")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding()
                        }
                    }
                }

                Divider()

                HStack {
                    if selectedSkillId != nil {
                        Button("清除选择") {
                            selectedSkillId = nil
                        }
                        .buttonStyle(.plain)
                        .font(.caption)
                        .foregroundStyle(.red)
                    }
                    Spacer()
                    Button("关闭") { onClose() }
                        .buttonStyle(.plain)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            .frame(width: 220)
            .background(Color.secondary.opacity(0.05))

            Divider()

            // Right detail
            VStack(alignment: .leading, spacing: 8) {
                if let skill = detailSkill {
                    HStack {
                        Text(skill.title)
                            .font(.headline)
                        Spacer()
                        Text("/\(skill.name)")
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    if let description = skill.descriptionText, !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if let tags = skill.tags, !tags.isEmpty {
                        HStack(spacing: 4) {
                            ForEach(tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.1))
                                    .foregroundStyle(.blue)
                                    .cornerRadius(4)
                            }
                        }
                    }
                    Divider()
                    ScrollView {
                        Text(skill.prompt)
                            .font(.caption.monospaced())
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .frame(maxHeight: 200)
                } else {
                    Text("hover 一项查看详情")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .frame(width: 320)
        }
        .frame(height: 360)
    }

    private func skillRow(_ skill: Skill) -> some View {
        let isSelected = skill.id == selectedSkillId
        return Button {
            selectedSkillId = isSelected ? nil : skill.id
            onClose()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? .orange : .secondary)
                    .font(.caption)
                VStack(alignment: .leading, spacing: 1) {
                    Text(skill.title)
                        .font(.caption.weight(.medium))
                        .lineLimit(1)
                        .foregroundStyle(.primary)
                    if let description = skill.descriptionText, !description.isEmpty {
                        Text(description)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .background(hoverSkill?.id == skill.id ? Color.accentColor.opacity(0.1) : Color.clear)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            if hovering {
                hoverSkill = skill
            }
        }
    }
}
