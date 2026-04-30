import Foundation

struct RAGService {
    static func chunkText(_ text: String, chunkSize: Int = 800, overlap: Int = 150) -> [String] {
        guard !text.isEmpty else { return [] }
        var chunks: [String] = []
        var start = text.startIndex

        while start < text.endIndex {
            let end = text.index(start, offsetBy: chunkSize, limitedBy: text.endIndex) ?? text.endIndex
            var chunkEnd = end

            // Try to break at sentence boundary
            if end < text.endIndex {
                let searchStart = text.index(end, offsetBy: -min(100, chunkSize / 4), limitedBy: start) ?? start
                let searchRange = searchStart..<end
                if let sentenceEnd = text[searchRange].lastIndex(where: { ".!?。！？".contains($0) }) {
                    chunkEnd = text.index(after: sentenceEnd)
                }
            }

            let chunk = String(text[start..<chunkEnd]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !chunk.isEmpty {
                chunks.append(chunk)
            }

            // Move forward with overlap
            let nextStart = text.index(chunkEnd, offsetBy: -overlap, limitedBy: start) ?? start
            start = max(nextStart, text.index(after: start))
            if start >= chunkEnd {
                start = chunkEnd
            }
        }
        return chunks
    }

    static func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return 0 }
        var dot: Float = 0, normA: Float = 0, normB: Float = 0
        for i in 0..<a.count {
            dot += a[i] * b[i]
            normA += a[i] * a[i]
            normB += b[i] * b[i]
        }
        let denom = sqrt(normA) * sqrt(normB)
        return denom > 0 ? dot / denom : 0
    }

    struct SearchResult: Identifiable {
        let id: String
        let content: String
        let score: Double
        let source: Source
        let chunkIndex: Int?

        enum Source {
            case paper, note
        }
    }

    static func searchPaperChunks(
        queryEmbedding: [Float],
        paperRepo: PaperRepository,
        topK: Int = 5
    ) -> [SearchResult] {
        guard let chunks = try? paperRepo.getChunksWithEmbeddings() else { return [] }

        return chunks
            .map { (id: $0.id, content: $0.content, score: cosineSimilarity(queryEmbedding, $0.embedding)) }
            .filter { $0.score > 0.1 }
            .sorted { $0.score > $1.score }
            .prefix(topK)
            .map { SearchResult(id: $0.id, content: $0.content, score: Double($0.score), source: .paper, chunkIndex: nil) }
    }

    static func searchKnowledgeNotes(
        queryEmbedding: [Float],
        knowledgeRepo: KnowledgeRepository,
        topK: Int = 5
    ) -> [SearchResult] {
        guard let notes = try? knowledgeRepo.getNotesWithEmbeddings() else { return [] }

        return notes
            .map { (id: $0.id, content: $0.content, score: cosineSimilarity(queryEmbedding, $0.embedding)) }
            .filter { $0.score > 0.1 }
            .sorted { $0.score > $1.score }
            .prefix(topK)
            .map { SearchResult(id: $0.id, content: $0.content, score: Double($0.score), source: .note, chunkIndex: nil) }
    }

    static func combinedSearch(
        queryEmbedding: [Float],
        paperRepo: PaperRepository,
        knowledgeRepo: KnowledgeRepository,
        topK: Int = 10
    ) -> [SearchResult] {
        let papers = searchPaperChunks(queryEmbedding: queryEmbedding, paperRepo: paperRepo, topK: topK)
        let notes = searchKnowledgeNotes(queryEmbedding: queryEmbedding, knowledgeRepo: knowledgeRepo, topK: topK)
        return (papers + notes).sorted { $0.score > $1.score }.prefix(topK).map { $0 }
    }
}
