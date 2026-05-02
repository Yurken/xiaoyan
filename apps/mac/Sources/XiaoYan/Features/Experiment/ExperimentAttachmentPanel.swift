import SwiftUI

/// 实验附件面板：上传 + 列表 + 行内 label 编辑 + 删除。
/// 1:1 desktop `Experiment.tsx:81-215, 496-498` AttachmentPanel
struct ExperimentAttachmentPanel: View {
    let experimentId: String
    @State private var attachments: [ExperimentAttachment] = []
    @State private var showingImporter = false
    @State private var editingLabelId: String?
    @State private var draftLabel = ""

    private let repo = ExperimentRepository()

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("附件")
                    .font(.headline)
                Spacer()
                Button {
                    showingImporter = true
                } label: {
                    Label("上传", systemImage: "plus")
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            if attachments.isEmpty {
                Text("暂无附件")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: 6) {
                    ForEach(attachments) { att in
                        attachmentRow(att)
                    }
                }
            }
        }
        .onAppear(perform: load)
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.data, .image, .pdf, .plainText],
            allowsMultipleSelection: true
        ) { result in
            handleImport(result)
        }
    }

    // MARK: - Row

    private func attachmentRow(_ att: ExperimentAttachment) -> some View {
        HStack(spacing: 8) {
            Image(systemName: iconName(for: att.filePath))
                .font(.caption)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(URL(fileURLWithPath: att.filePath).lastPathComponent)
                    .font(.caption)
                    .lineLimit(1)
                if editingLabelId == att.id {
                    HStack(spacing: 4) {
                        TextField("标签", text: $draftLabel)
                            .textFieldStyle(.roundedBorder)
                            .font(.caption)
                            .frame(width: 140)
                        Button("保存") {
                            saveLabel(id: att.id)
                        }
                        .font(.caption2)
                        .buttonStyle(.borderless)
                        Button("取消") {
                            editingLabelId = nil
                        }
                        .font(.caption2)
                        .buttonStyle(.borderless)
                    }
                } else if let label = att.label, !label.isEmpty {
                    Text(label)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            if editingLabelId != att.id {
                Button {
                    startEditingLabel(att)
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.borderless)
            }

            Button {
                deleteAttachment(att)
            } label: {
                Image(systemName: "trash")
                    .font(.caption2)
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
    }

    // MARK: - Actions

    private func load() {
        attachments = (try? repo.listAttachments(experimentId: experimentId)) ?? []
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        guard case let .success(urls) = result else { return }
        for url in urls {
            let attachment = ExperimentAttachment(
                id: UUID().uuidString,
                experimentId: experimentId,
                filePath: url.path,
                label: nil
            )
            try? repo.insertAttachment(attachment)
        }
        load()
    }

    private func startEditingLabel(_ att: ExperimentAttachment) {
        draftLabel = att.label ?? ""
        editingLabelId = att.id
    }

    private func saveLabel(id: String) {
        try? repo.updateAttachmentLabel(id: id, label: draftLabel)
        editingLabelId = nil
        load()
    }

    private func deleteAttachment(_ att: ExperimentAttachment) {
        try? repo.deleteAttachment(id: att.id)
        load()
    }

    private func iconName(for path: String) -> String {
        let ext = URL(fileURLWithPath: path).pathExtension.lowercased()
        switch ext {
        case "pdf": return "doc.text"
        case "jpg", "jpeg", "png", "gif", "webp": return "photo"
        case "txt", "md", "csv", "json": return "doc.plaintext"
        default: return "doc"
        }
    }
}
