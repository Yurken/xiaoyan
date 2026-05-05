import Foundation
import PDFKit
import Combine

@MainActor
final class PaperService: ObservableObject {
    @Published var uploadProgress: [String: PaperStatus] = [:]

    private let paperRepo = PaperRepository()
    private let memoryRepo = MemoryRepository()

    // MARK: - List & Get

    func list(researchInterestId: String? = nil) -> [Paper] {
        (try? paperRepo.list(researchInterestId: researchInterestId)) ?? []
    }

    func get(id: String) -> Paper? {
        try? paperRepo.get(id: id)
    }

    // MARK: - Upload & Parse Pipeline

    func upload(fileURL: URL, settings: AppSettings, researchInterestId: String? = nil) async -> Paper {
        let paperId = UUID().uuidString
        let destDir = AppConstants.papersDirectory.appendingPathComponent(paperId)
        try? FileManager.default.createDirectory(at: destDir, withIntermediateDirectories: true)

        let destURL = destDir.appendingPathComponent(fileURL.lastPathComponent)
        try? FileManager.default.copyItem(at: fileURL, to: destURL)

        let paper = Paper(
            id: paperId,
            title: fileURL.deletingPathExtension().lastPathComponent,
            authors: [],
            abstractText: nil,
            year: nil,
            venue: nil,
            doi: nil,
            filePath: destURL.path,
            fullText: nil,
            researchInterestId: researchInterestId,
            tags: [],
            importanceColor: nil,
            notes: nil,
            status: .uploaded,
            createdAt: Date()
        )

        try? paperRepo.insert(paper)
        recordPaperMemory(eventType: "paper.uploaded", paperTitle: paper.title, paperId: paper.id, importance: 3)
        uploadProgress[paperId] = .parsing

        // Background pipeline
        Task.detached { @MainActor [weak self] in
            await self?.processPaperPipeline(paperId: paperId, fileURL: destURL, settings: settings)
        }

        return paper
    }

    private func processPaperPipeline(paperId: String, fileURL: URL, settings: AppSettings) async {
        // Step 1: Extract text
        let fullText = extractPDFText(url: fileURL) ?? ""

        // Step 2: LLM metadata recognition
        var title = fileURL.deletingPathExtension().lastPathComponent
        var authors: [String] = []
        var year: Int?
        var venue: String?
        var doi: String?
        var abstract: String?

        if let client = LLMClient.fromSettings(settings) {
            let prompt = """
            从以下论文文本中提取元数据，返回 JSON 格式：
            {"title": "...", "authors": ["..."], "year": 2024, "venue": "...", "doi": "...", "abstract": "..."}

            论文文本（前 3000 字符）：
            \(String(fullText.prefix(3000)))
            """
            if let response = try? await client.chat(
                messages: [LLMClient.Message(role: "user", content: prompt)],
                systemPrompt: "你是一个论文元数据提取工具。只返回 JSON，不要其他内容。"
            ) {
                if let data = response.data(using: .utf8),
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    title = json["title"] as? String ?? title
                    authors = json["authors"] as? [String] ?? []
                    year = json["year"] as? Int
                    venue = json["venue"] as? String
                    doi = json["doi"] as? String
                    abstract = json["abstract"] as? String
                }
            }
        }

        // Step 3: Update paper with metadata
        try? paperRepo.update(Paper(
            id: paperId, title: title, authors: authors,
            abstractText: abstract, year: year, venue: venue, doi: doi,
            filePath: fileURL.path, fullText: fullText,
            researchInterestId: nil, tags: [], importanceColor: nil,
            notes: nil, status: .parsed, createdAt: Date()
        ))

        // Step 4: Chunk text
        let chunkSize = Int(settings.get("chunk_size") ?? "800") ?? 800
        let overlap = Int(settings.get("chunk_overlap") ?? "150") ?? 150
        let chunks = RAGService.chunkText(fullText, chunkSize: chunkSize, overlap: overlap)

        // Step 5: Generate embeddings
        if let embedClient = EmbeddingClient.fromSettings(settings), !chunks.isEmpty {
            let batchSize = Int(settings.get("embedding_batch_size") ?? "20") ?? 20
            var allEmbeddings: [[Float]] = []

            for batchStart in stride(from: 0, to: chunks.count, by: batchSize) {
                let batchEnd = min(batchStart + batchSize, chunks.count)
                let batch = Array(chunks[batchStart..<batchEnd])
                if let embeddings = try? await embedClient.embed(texts: batch) {
                    allEmbeddings.append(contentsOf: embeddings)
                }
            }

            // Step 6: Save chunks with embeddings
            var paperChunks: [PaperChunk] = []
            for (i, chunk) in chunks.enumerated() {
                paperChunks.append(PaperChunk(
                    id: UUID().uuidString,
                    paperId: paperId,
                    chunkIndex: i,
                    content: chunk,
                    embedding: i < allEmbeddings.count ? allEmbeddings[i] : nil,
                    tokenCount: nil
                ))
            }
            try? paperRepo.insertChunks(paperChunks)
        }

        uploadProgress[paperId] = .analyzed
    }

    // MARK: - PDF Operations

    func extractPDFText(url: URL) -> String? {
        guard let doc = PDFDocument(url: url) else { return nil }
        var text = ""
        for i in 0..<doc.pageCount {
            if let page = doc.page(at: i), let content = page.string {
                text += content + "\n"
            }
        }
        return text.isEmpty ? nil : text
    }

    func openFile(paperId: String) {
        guard let paper = get(id: paperId),
              let filePath = paper.filePath,
              FileManager.default.fileExists(atPath: filePath) else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: filePath))
    }

    func listFigures(paperId: String) -> [PaperFigure] {
        (try? paperRepo.listFigures(paperId: paperId)) ?? []
    }

    // MARK: - Analyze & Reproduce

    func analyze(paperId: String, settings: AppSettings) async {
        guard let paper = get(id: paperId),
              let fullText = paper.fullText else { return }

        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["paper_analysis_model"],
            temperatureKeys: []
        ) else { return }

        let prompt = """
        请分析以下论文，返回 JSON 格式：
        {"research_question":"...","core_method":"...","experiment_design":"...","experiment_results":"...","innovations":"...","limitations":"...","key_conclusions":"..."}

        论文：\(paper.title)
        \(String(fullText.prefix(8000)))
        """

        do {
            let response = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: prompt)],
                systemPrompt: "你是学术论文分析专家。只返回 JSON，不要其他内容。"
            )
            let parsed = parseJSONAnalysis(response, paperId: paperId)
            try? paperRepo.upsertAnalysis(paperId, analysis: parsed)
            try? paperRepo.updateStatus(id: paperId, status: .analyzed)
            recordPaperMemory(eventType: "paper.analyzed", paperTitle: paper.title, paperId: paperId, importance: 4)
        } catch {
            // Fallback: save raw
            let analysis = PaperAnalysis(
                id: UUID().uuidString, paperId: paperId,
                researchQuestion: nil, coreMethod: nil,
                experimentDesign: nil, experimentResults: nil,
                innovations: nil, limitations: nil,
                keyConclusions: nil, rawAnalysis: error.localizedDescription
            )
            try? paperRepo.upsertAnalysis(paperId, analysis: analysis)
        }
    }

    func reproduce(paperId: String, settings: AppSettings) async {
        guard let paper = get(id: paperId),
              let fullText = paper.fullText else { return }

        guard let client = LLMClient.fromSettings(
            settings,
            modelKeys: ["paper_reproduction_model"],
            temperatureKeys: []
        ) else { return }

        let prompt = """
        请为以下论文生成复现指导，返回 JSON 格式：
        {"environment_setup":"...","dependencies":"...","data_requirements":"...","reproduction_steps":"...","expected_results":"...","common_pitfalls":"..."}

        论文：\(paper.title)
        \(String(fullText.prefix(8000)))
        """

        do {
            let response = try await client.chat(
                messages: [LLMClient.Message(role: "user", content: prompt)],
                systemPrompt: "你是实验复现专家。只返回 JSON，不要其他内容。"
            )
            let parsed = parseJSONReproduction(response, paperId: paperId)
            try? paperRepo.upsertReproductionGuide(paperId, guide: parsed)
        } catch {
            let guide = ReproductionGuide(
                id: UUID().uuidString, paperId: paperId,
                codeRepository: nil, environmentSetup: nil,
                dependencies: nil, dataRequirements: nil,
                reproductionSteps: nil, expectedResults: nil,
                commonPitfalls: nil, notes: error.localizedDescription
            )
            try? paperRepo.upsertReproductionGuide(paperId, guide: guide)
        }
    }

    private func parseJSONAnalysis(_ text: String, paperId: String) -> PaperAnalysis {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = clean.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return PaperAnalysis(
                id: UUID().uuidString, paperId: paperId,
                researchQuestion: nil, coreMethod: nil,
                experimentDesign: nil, experimentResults: nil,
                innovations: nil, limitations: nil,
                keyConclusions: nil, rawAnalysis: text
            )
        }
        return PaperAnalysis(
            id: UUID().uuidString, paperId: paperId,
            researchQuestion: json["research_question"],
            coreMethod: json["core_method"],
            experimentDesign: json["experiment_design"],
            experimentResults: json["experiment_results"],
            innovations: json["innovations"],
            limitations: json["limitations"],
            keyConclusions: json["key_conclusions"],
            rawAnalysis: text
        )
    }

    private func parseJSONReproduction(_ text: String, paperId: String) -> ReproductionGuide {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = clean.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return ReproductionGuide(
                id: UUID().uuidString, paperId: paperId,
                codeRepository: nil, environmentSetup: nil,
                dependencies: nil, dataRequirements: nil,
                reproductionSteps: nil, expectedResults: nil,
                commonPitfalls: nil, notes: text
            )
        }
        return ReproductionGuide(
            id: UUID().uuidString, paperId: paperId,
            codeRepository: json["code_repository"],
            environmentSetup: json["environment_setup"],
            dependencies: json["dependencies"],
            dataRequirements: json["data_requirements"],
            reproductionSteps: json["reproduction_steps"],
            expectedResults: json["expected_results"],
            commonPitfalls: json["common_pitfalls"],
            notes: nil
        )
    }

    // MARK: - Update

    func update(paper: Paper) {
        try? paperRepo.update(paper)
    }

    // MARK: - Delete

    func delete(paperId: String) {
        if let paper = get(id: paperId), let filePath = paper.filePath {
            try? FileManager.default.removeItem(atPath: filePath)
        }
        try? paperRepo.delete(id: paperId)
    }

    // MARK: - Memory

    func recordPaperMemory(eventType: String, paperTitle: String, paperId: String? = nil, importance: Int = 2) {
        let event = MemoryEvent(
            id: UUID().uuidString,
            sessionId: nil,
            runId: nil,
            eventType: eventType,
            source: "paper",
            summary: paperTitle,
            payloadJson: paperId,
            createdAt: Date()
        )
        try? memoryRepo.insertEvent(event)
        let observation = MemoryObservation(
            id: UUID().uuidString,
            eventId: event.id,
            sessionId: nil,
            runId: nil,
            source: "paper",
            eventType: eventType,
            title: paperTitle,
            summary: eventType,
            narrative: nil,
            importance: importance,
            createdAt: Date()
        )
        try? memoryRepo.insertObservation(observation)
    }
}
