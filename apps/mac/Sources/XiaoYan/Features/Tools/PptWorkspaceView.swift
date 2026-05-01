import SwiftUI
import UniformTypeIdentifiers
import PDFKit

struct PptWorkspaceView: View {
    @EnvironmentObject var settings: AppSettings

    @State private var mode: PptMode = .topic
    @State private var topic = ""
    @State private var outline = ""
    @State private var documentContent: String?
    @State private var documentName: String?
    @State private var documentLoading = false
    @State private var documentError: String?

    @State private var styleValue = "auto"
    @State private var customStyle = ""
    @State private var language = "auto"
    @State private var pageCount = "auto"
    @State private var customPages = ""

    @State private var resultData: PptData?
    @State private var pptxData: Data?
    @State private var fileBaseName = "slides"
    @State private var status: PptStatus = .idle
    @State private var errorMessage: String?
    @State private var slideCount = 0
    @State private var activeGenerationId: UUID?

    private var generating: Bool {
        status == .drafting || status == .repairing || status == .building
    }

    private var customPageInvalid: Bool {
        guard pageCount == "custom" else { return false }
        guard let count = Int(customPages.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return true
        }
        return count < 4 || count > 40
    }

    private var generateDisabledReason: String? {
        if generating { return "当前正在生成，请等待完成" }
        switch mode {
        case .topic:
            if topic.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "请输入演示主题" }
        case .outline:
            if outline.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "请输入大纲" }
        case .document:
            if documentLoading { return "文档仍在读取中" }
            if documentContent == nil { return "请先上传文档" }
            if documentError != nil { return "请先修复文档读取错误" }
        }
        if styleValue == "custom" && customStyle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "请输入自定义风格"
        }
        if customPageInvalid { return "页数需填写 4 到 40 之间的整数" }
        return nil
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    headerSection
                    modePicker
                    inputSection
                    optionsSection
                    actionSection
                    if status == .error, let error = errorMessage {
                        errorBanner(error)
                    }
                }
                .padding()
            }

            if let data = resultData {
                Divider()
                PptPreviewPanel(
                    data: data,
                    onCopyMarkdown: copyMarkdown,
                    onSaveMarkdown: saveMarkdown,
                    onSavePptx: savePptx
                )
                    .frame(minHeight: 200)
            }
        }
        .navigationTitle("幻灯片生成")
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(spacing: 12) {
            Image(systemName: "play.presentation")
                .font(.title3)
                .foregroundStyle(.blue)
            VStack(alignment: .leading, spacing: 2) {
                Text("幻灯片生成")
                    .font(.headline)
                Text("输入主题、文档或大纲后，小妍会生成可预览的页面结构，并导出为 PowerPoint 文件。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    // MARK: - Mode Picker

    private var modePicker: some View {
        Picker("模式", selection: $mode) {
            Text("输入主题").tag(PptMode.topic)
            Text("上传文档").tag(PptMode.document)
            Text("粘贴大纲").tag(PptMode.outline)
        }
        .pickerStyle(.segmented)
    }

    // MARK: - Input Section

    @ViewBuilder
    private var inputSection: some View {
        switch mode {
        case .topic:
            VStack(alignment: .leading, spacing: 4) {
                TextEditor(text: $topic)
                    .font(.body)
                    .frame(minHeight: 80)
                    .padding(4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                Text("小妍会自动决定幻灯片数量、内容深度与配图风格")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .outline:
            VStack(alignment: .leading, spacing: 4) {
                TextEditor(text: $outline)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 160)
                    .padding(4)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                Text("小妍会按照大纲层级整理为幻灯片结构")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .document:
            documentDropZone
        }
    }

    private var documentDropZone: some View {
        VStack(spacing: 8) {
            if let name = documentName {
                VStack(spacing: 6) {
                    Image(systemName: "doc.text")
                        .font(.title2)
                        .foregroundStyle(.blue)
                    Text(name)
                        .font(.subheadline.bold())
                    if let content = documentContent {
                        Text("已提取约 \(content.count) 字内容")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Button("移除文件") {
                        documentName = nil
                        documentContent = nil
                        documentError = nil
                    }
                    .font(.caption)
                    .foregroundStyle(.red)
                }
                .padding(20)
                .frame(maxWidth: .infinity)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.secondary.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [6]))
                )
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "arrow.down.doc")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    Text("拖拽文件到此处")
                        .font(.subheadline.bold())
                    Text("支持 PDF、TXT、MD 文档")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("选择文件") {
                        pickDocument()
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
                .padding(24)
                .frame(maxWidth: .infinity)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.secondary.opacity(0.3), style: StrokeStyle(lineWidth: 2, dash: [6]))
                )
                .onDrop(of: [.fileURL], isTargeted: nil) { providers in
                    handleDrop(providers: providers)
                    return true
                }
            }

            if documentLoading {
                Text("正在读取文档内容…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let error = documentError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
    }

    // MARK: - Options

    private var optionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            optionRow(label: "风格", options: PPT_STYLE_OPTIONS, selection: $styleValue)
            if styleValue == "custom" {
                TextField("输入科研风格（如：算法推导型）", text: $customStyle)
                    .textFieldStyle(.roundedBorder)
            }
            optionRow(label: "语言", options: PPT_LANGUAGE_OPTIONS, selection: $language)
            optionRow(label: "页数", options: PPT_PAGE_OPTIONS, selection: $pageCount)
            if pageCount == "custom" {
                TextField("4-40", text: $customPages)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
            }
        }
    }

    private func optionRow(label: String, options: [PptOption], selection: Binding<String>) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 32, alignment: .trailing)
            FlowLayout(spacing: 6) {
                ForEach(options, id: \.value) { option in
                    Button(option.label) {
                        selection.wrappedValue = option.value
                    }
                    .buttonStyle(.plain)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(selection.wrappedValue == option.value ? Color.blue.opacity(0.12) : Color(nsColor: .controlBackgroundColor))
                    .foregroundColor(selection.wrappedValue == option.value ? .blue : .secondary)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(selection.wrappedValue == option.value ? Color.blue.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
                    .cornerRadius(12)
                }
            }
            Spacer()
        }
    }

    // MARK: - Actions

    private var actionSection: some View {
        HStack {
            statusText
            Spacer()
            if status == .ready {
                Button("保存 .pptx") {
                    savePptx()
                }
                .buttonStyle(.borderedProminent)
                Button("重新生成") {
                    generate()
                }
                .buttonStyle(.bordered)
            } else {
                Button("立即生成") {
                    generate()
                }
                .buttonStyle(.borderedProminent)
                .disabled(generateDisabledReason != nil || generating)
            }
        }
    }

    @ViewBuilder
    private var statusText: some View {
        switch status {
        case .drafting:
            HStack(spacing: 4) {
                ProgressView().controlSize(.small)
                Text("小妍正在规划页面结构与叙事节奏…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .repairing:
            HStack(spacing: 4) {
                ProgressView().controlSize(.small)
                Text("正在修复模型返回格式，避免生成失败…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .building:
            HStack(spacing: 4) {
                ProgressView().controlSize(.small)
                Text("正在整理为 .pptx 文件…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .ready:
            HStack(spacing: 4) {
                Image(systemName: "checkmark.circle")
                    .foregroundStyle(.green)
                Text("已生成 \(slideCount) 张幻灯片，可直接在 PowerPoint / WPS 中打开")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        case .error:
            if let reason = generateDisabledReason {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        case .idle:
            if let reason = generateDisabledReason {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("默认会先给出结构预览，再保存最终文件。")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
            Spacer()
        }
        .padding(10)
        .background(Color.red.opacity(0.08))
        .cornerRadius(8)
    }

    // MARK: - Document Handling

    private func pickDocument() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.pdf, .plainText, .init(filenameExtension: "md")].compactMap { $0 }
        panel.allowsMultipleSelection = false
        panel.begin { result in
            if result == .OK, let url = panel.url {
                loadDocument(url: url)
            }
        }
    }

    private func handleDrop(providers: [NSItemProvider]) {
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    if let data = item as? Data,
                       let url = URL(dataRepresentation: data, relativeTo: nil) {
                        DispatchQueue.main.async {
                            self.loadDocument(url: url)
                        }
                    }
                }
            }
        }
    }

    private func loadDocument(url: URL) {
        documentLoading = true
        documentError = nil
        documentName = url.lastPathComponent
        Task {
            do {
                let text: String
                if url.pathExtension.lowercased() == "pdf" {
                    text = try await extractTextFromPDF(url: url)
                } else {
                    text = try String(contentsOf: url, encoding: .utf8)
                }
                await MainActor.run {
                    documentContent = text
                    documentLoading = false
                }
            } catch {
                await MainActor.run {
                    documentError = "读取失败: \(error.localizedDescription)"
                    documentLoading = false
                }
            }
        }
    }

    private func extractTextFromPDF(url: URL) async throws -> String {
        guard let doc = PDFDocument(url: url) else {
            throw PptError.pdfReadFailed
        }
        var text = ""
        for i in 0..<doc.pageCount {
            if let page = doc.page(at: i), let content = page.string {
                text += content + "\n"
            }
        }
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            throw PptError.pdfEmpty
        }
        return text
    }

    private enum PptError: Error, LocalizedError {
        case pdfReadFailed
        case pdfEmpty
        case documentContentMissing

        var errorDescription: String? {
            switch self {
            case .pdfReadFailed: return "无法读取 PDF 文件"
            case .pdfEmpty: return "PDF 内容为空或无法提取文本"
            case .documentContentMissing: return "文档内容为空，无法生成"
            }
        }
    }

    // MARK: - Generation

    private func generate() {
        guard generateDisabledReason == nil else { return }

        if mode == .document {
            guard let content = documentContent, !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                status = .error
                errorMessage = PptError.documentContentMissing.errorDescription
                return
            }
        }

        status = .drafting
        errorMessage = nil
        resultData = nil
        pptxData = nil
        fileBaseName = "slides"
        slideCount = 0
        let generationId = UUID()
        activeGenerationId = generationId

        let prompt = PptPromptBuilder.buildPrompt(
            mode: mode,
            topic: topic,
            outline: outline,
            documentContent: documentContent,
            styleValue: styleValue,
            customStyle: customStyle,
            language: language,
            pageCount: pageCount,
            customPages: customPages
        )
        let settingsSnapshot = settings.settings

        Task {
            let client = LLMClient.fromSettings(
                settingsSnapshot,
                modelKeys: ["copilot_simple_model"],
                temperatureKeys: ["copilot_simple_temperature"]
            )

            guard let client else {
                await finishGenerationIfActive(generationId, error: "请先在设置中配置 LLM 提供商。")
                return
            }

            var response = ""
            do {
                response = try await client.chat(
                    messages: [LLMClient.Message(role: "user", content: prompt)],
                    systemPrompt: "你是一位专业的学术幻灯片结构设计师。只输出合法 JSON，不要 markdown 代码块，不要解释。"
                )
                try await buildResult(response, generationId: generationId)
            } catch {
                await attemptRepair(client: client, raw: response, generationId: generationId)
            }
        }
    }

    private func buildResult(_ text: String, generationId: UUID) async throws {
        let decoded = try PptResponseParser.parse(text)
        guard await generationIsActive(generationId) else { return }
        await MainActor.run {
            status = .building
        }
        let data = try PptxBuilder.build(data: decoded)
        await MainActor.run {
            guard activeGenerationId == generationId else { return }
            resultData = decoded
            pptxData = data
            fileBaseName = PptFileName.sanitize(decoded.title)
            slideCount = decoded.slides.count
            status = .ready
            activeGenerationId = nil
        }
    }

    private func attemptRepair(client: LLMClient, raw: String, generationId: UUID) async {
        await MainActor.run {
            guard activeGenerationId == generationId else { return }
            status = .repairing
        }
        do {
            let repairPrompt = PptPromptBuilder.buildRepairPrompt(raw: raw)
            let response = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: repairPrompt)],
                systemPrompt: "你只修复 JSON 格式，不修改语义。"
            )
            try await buildResult(response, generationId: generationId)
        } catch {
            await finishGenerationIfActive(generationId, error: "生成失败: \(error.localizedDescription)")
        }
    }

    private func generationIsActive(_ generationId: UUID) async -> Bool {
        await MainActor.run { activeGenerationId == generationId }
    }

    private func finishGenerationIfActive(_ generationId: UUID, error: String) async {
        await MainActor.run {
            guard activeGenerationId == generationId else { return }
            status = .error
            errorMessage = error
            activeGenerationId = nil
        }
    }

    // MARK: - Export

    private func copyMarkdown() {
        guard let data = resultData else { return }
        let md = PptMarkdownExporter.export(data: data)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(md, forType: .string)
    }

    private func saveMarkdown() {
        guard let data = resultData else { return }
        let md = PptMarkdownExporter.export(data: data)
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.plainText]
        panel.nameFieldStringValue = "\(PptFileName.sanitize(data.title)).md"
        panel.begin { result in
            if result == .OK, let url = panel.url {
                try? md.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }

    private func savePptx() {
        guard let data = pptxData else { return }
        let panel = NSSavePanel()
        if let pptxType = UTType(filenameExtension: "pptx") {
            panel.allowedContentTypes = [pptxType]
        }
        panel.nameFieldStringValue = "\(fileBaseName).pptx"
        panel.begin { result in
            if result == .OK, let url = panel.url {
                try? data.write(to: url, options: .atomic)
            }
        }
    }
}
