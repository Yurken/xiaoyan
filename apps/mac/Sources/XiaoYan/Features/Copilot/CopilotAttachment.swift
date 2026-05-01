import Foundation
import PDFKit

// MARK: - Types

struct CopilotAttachmentMeta: Codable, Equatable {
    let name: String
    let `extension`: String
    let mediaTypeLabel: String
}

struct PendingCopilotAttachment: Identifiable, Equatable {
    let id: String
    let path: String
    let name: String
    let `extension`: String
    let mediaTypeLabel: String
    let content: String
}

// MARK: - Manager

@MainActor
final class CopilotAttachmentManager: ObservableObject {
    nonisolated static let maxAttachments = 5
    nonisolated static let maxTextChars = 12000
    nonisolated static let textExtensions: Set<String> = [
        "txt", "md", "markdown", "json", "jsonl", "csv", "tsv", "yaml", "yml", "log",
        "py", "js", "jsx", "ts", "tsx", "rs", "go", "java", "c", "cc", "cpp", "h", "hpp",
        "css", "html", "xml", "sql", "sh", "toml", "ini",
    ]

    @Published var pending: [PendingCopilotAttachment] = []
    @Published var isUploading: Bool = false
    @Published var lastError: String?

    func add(urls: [URL]) async {
        guard !urls.isEmpty else { return }
        if pending.count >= Self.maxAttachments {
            lastError = "最多只能添加 \(Self.maxAttachments) 个附件。"
            return
        }
        isUploading = true
        defer { isUploading = false }
        lastError = nil

        let existingPaths = Set(pending.map { $0.path })
        let acceptable = urls
            .filter { !existingPaths.contains($0.path) }
            .prefix(Self.maxAttachments - pending.count)

        var nextItems: [PendingCopilotAttachment] = []
        var failed: [String] = []

        for url in acceptable {
            let name = url.lastPathComponent
            let ext = url.pathExtension.lowercased()
            do {
                let content = try await readContent(url: url, extension: ext)
                let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else {
                    throw CopilotAttachmentError.empty
                }
                nextItems.append(PendingCopilotAttachment(
                    id: "\(Int(Date().timeIntervalSince1970 * 1000))-\(url.path)",
                    path: url.path,
                    name: name,
                    extension: ext,
                    mediaTypeLabel: Self.mediaTypeLabel(for: ext),
                    content: trimmed
                ))
            } catch {
                failed.append("\(name)：\(error.localizedDescription)")
            }
        }

        if !nextItems.isEmpty {
            pending.append(contentsOf: nextItems)
        }
        if !failed.isEmpty {
            lastError = failed.joined(separator: "；")
        } else if acceptable.count < urls.count {
            lastError = "部分文件未添加：已达到 \(Self.maxAttachments) 个附件上限，或文件已在列表中。"
        }
    }

    func remove(id: String) {
        pending.removeAll { $0.id == id }
    }

    func clear() {
        pending.removeAll()
        lastError = nil
    }

    // MARK: - Content Reading

    private func readContent(url: URL, extension ext: String) async throws -> String {
        if ext == "pdf" {
            return try await Task.detached(priority: .userInitiated) {
                guard let text = Self.extractPDFText(url: url) else {
                    throw CopilotAttachmentError.pdfParseFailed
                }
                return Self.truncate(text, max: Self.maxTextChars)
            }.value
        }
        guard Self.textExtensions.contains(ext) else {
            throw CopilotAttachmentError.unsupported(ext: ext)
        }
        return try await Task.detached(priority: .userInitiated) {
            let text = (try? String(contentsOf: url, encoding: .utf8))
                ?? (try? String(contentsOf: url, encoding: .isoLatin1))
                ?? ""
            if text.isEmpty {
                throw CopilotAttachmentError.empty
            }
            return Self.truncate(text, max: Self.maxTextChars)
        }.value
    }

    nonisolated private static func extractPDFText(url: URL) -> String? {
        guard let doc = PDFDocument(url: url) else { return nil }
        var text = ""
        for i in 0..<doc.pageCount {
            if let page = doc.page(at: i), let content = page.string {
                text += content + "\n"
            }
        }
        return text.isEmpty ? nil : text
    }

    nonisolated private static func truncate(_ text: String, max: Int) -> String {
        guard text.count > max else { return text }
        let endIndex = text.index(text.startIndex, offsetBy: max)
        return String(text[..<endIndex])
    }

    nonisolated static func mediaTypeLabel(for ext: String) -> String {
        ext == "pdf" ? "PDF" : "文本"
    }
}

enum CopilotAttachmentError: LocalizedError {
    case empty
    case pdfParseFailed
    case unsupported(ext: String)

    var errorDescription: String? {
        switch self {
        case .empty: return "没有提取到可读内容"
        case .pdfParseFailed: return "PDF 解析失败"
        case .unsupported(let ext): return "暂不支持读取该文件类型：.\(ext.isEmpty ? "unknown" : ext)"
        }
    }
}

// MARK: - Message Content Build / Parse
//
// 与 desktop apps/desktop/src/features/copilot/shared.ts:135-203 字节级对齐：
//   {text}\n
//   <copilot-attachments data="{percentEncoded(JSON({attachments:[{name,extension,mediaTypeLabel}]}))}"></copilot-attachments>\n
//   <copilot-file-context>...</copilot-file-context>

private struct CopilotAttachmentEnvelope: Codable {
    let attachments: [CopilotAttachmentMeta]
}

private let attachmentMetaPattern = #"<copilot-attachments data="([^"]+)"></copilot-attachments>"#
private let attachmentContextPattern = #"\n*<copilot-file-context>[\s\S]*?</copilot-file-context>"#

private extension CharacterSet {
    static let jsURIComponentAllowed: CharacterSet = {
        var set = CharacterSet()
        set.formUnion(.alphanumerics)
        set.insert(charactersIn: "-_.!~*'()")
        return set
    }()
}

func buildCopilotMessageContent(text: String, attachments: [PendingCopilotAttachment]) -> String {
    guard !attachments.isEmpty else { return text }

    let envelope = CopilotAttachmentEnvelope(attachments: attachments.map {
        CopilotAttachmentMeta(name: $0.name, extension: $0.extension, mediaTypeLabel: $0.mediaTypeLabel)
    })
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.withoutEscapingSlashes]
    guard let jsonData = try? encoder.encode(envelope),
          let jsonString = String(data: jsonData, encoding: .utf8) else {
        return text
    }
    let metadata = jsonString.addingPercentEncoding(withAllowedCharacters: .jsURIComponentAllowed) ?? jsonString

    let context = attachments.enumerated().map { (index, attachment) -> String in
        let extLabel = attachment.extension.isEmpty ? "unknown" : ".\(attachment.extension)"
        return [
            "[文件 \(index + 1)] \(attachment.name)",
            "类型：\(attachment.mediaTypeLabel) (\(extLabel))",
            "以下是文件中提取出的可读内容片段：",
            attachment.content,
        ].joined(separator: "\n")
    }.joined(separator: "\n\n---\n\n")

    return [
        text,
        "",
        "<copilot-attachments data=\"\(metadata)\"></copilot-attachments>",
        "",
        "<copilot-file-context>",
        "用户本轮补充上传了文件。回答时请结合这些文件内容；如果文件内容不足以支撑结论，请明确说明不足之处。",
        "",
        context,
        "</copilot-file-context>",
    ].joined(separator: "\n")
}

func parseCopilotMessageContent(_ content: String) -> (text: String, attachments: [CopilotAttachmentMeta]) {
    var attachments: [CopilotAttachmentMeta] = []

    if let metaRegex = try? NSRegularExpression(pattern: attachmentMetaPattern),
       let match = metaRegex.firstMatch(in: content, range: NSRange(content.startIndex..., in: content)),
       match.numberOfRanges >= 2,
       let range = Range(match.range(at: 1), in: content) {
        let encoded = String(content[range])
        if let decoded = encoded.removingPercentEncoding,
           let data = decoded.data(using: .utf8),
           let envelope = try? JSONDecoder().decode(CopilotAttachmentEnvelope.self, from: data) {
            attachments = envelope.attachments
        }
    }

    var stripped = content
    if let metaRegex = try? NSRegularExpression(pattern: attachmentMetaPattern) {
        stripped = metaRegex.stringByReplacingMatches(
            in: stripped,
            range: NSRange(stripped.startIndex..., in: stripped),
            withTemplate: ""
        )
    }
    if let contextRegex = try? NSRegularExpression(pattern: attachmentContextPattern) {
        stripped = contextRegex.stringByReplacingMatches(
            in: stripped,
            range: NSRange(stripped.startIndex..., in: stripped),
            withTemplate: ""
        )
    }
    let text = stripped.trimmingCharacters(in: .whitespacesAndNewlines)
    return (text, attachments)
}
