import Foundation

struct CitationGraphService {
    private let repo = KnowledgeRepository()

    // MARK: - Centrality

    func centrality(limit: Int = 12) throws -> [CitationCentralityEntry] {
        let snapshot = try repo.graphSnapshot()
        let citations = snapshot.citations

        var outNeighbors: [String: Set<String>] = [:]
        var inNeighbors: [String: Set<String>] = [:]
        var paperIdsInGraph = Set<String>()

        for citation in citations {
            outNeighbors[citation.citingPaperId, default: []].insert(citation.citedPaperId)
            inNeighbors[citation.citedPaperId, default: []].insert(citation.citingPaperId)
            paperIdsInGraph.insert(citation.citingPaperId)
            paperIdsInGraph.insert(citation.citedPaperId)
        }

        let paperMap = Dictionary(uniqueKeysWithValues: snapshot.papers.map { ($0.id, $0) })
        let nodeCount = paperIdsInGraph.count
        let denominator = Float(max(1, (nodeCount - 1) * 2))

        var entries: [CitationCentralityEntry] = []
        for paperId in paperIdsInGraph {
            guard let paper = paperMap[paperId] else { continue }
            let inDeg = inNeighbors[paperId]?.count ?? 0
            let outDeg = outNeighbors[paperId]?.count ?? 0
            let degCent = Float(inDeg + outDeg) / denominator
            entries.append(CitationCentralityEntry(
                paperId: paper.id,
                title: paper.title,
                year: paper.year,
                venue: paper.venue,
                inDegree: inDeg,
                outDegree: outDeg,
                citationCount: inDeg,
                degreeCentrality: degCent
            ))
        }

        entries.sort {
            if $0.degreeCentrality != $1.degreeCentrality {
                return $0.degreeCentrality > $1.degreeCentrality
            }
            if $0.citationCount != $1.citationCount {
                return $0.citationCount > $1.citationCount
            }
            if $0.outDegree != $1.outDegree {
                return $0.outDegree > $1.outDegree
            }
            return $0.title < $1.title
        }

        let effectiveLimit = max(1, limit)
        if entries.count > effectiveLimit {
            entries = Array(entries.prefix(effectiveLimit))
        }
        return entries
    }

    // MARK: - Shortest Path

    func shortestPath(fromPaperId: String, toPaperId: String) throws -> CitationPathResult? {
        guard fromPaperId != toPaperId else {
            let snapshot = try repo.graphSnapshot()
            let paperMap = Dictionary(uniqueKeysWithValues: snapshot.papers.map { ($0.id, $0) })
            guard let paper = paperMap[fromPaperId] else { return nil }
            let node = CitationGraphNode(paperId: paper.id, title: paper.title, year: paper.year, venue: paper.venue)
            return CitationPathResult(nodes: [node], edges: [], length: 0)
        }

        let snapshot = try repo.graphSnapshot()
        let citations = snapshot.citations
        let paperMap = Dictionary(uniqueKeysWithValues: snapshot.papers.map { ($0.id, $0) })

        let paperIds = Set(snapshot.papers.map(\.id))
        guard paperIds.contains(fromPaperId), paperIds.contains(toPaperId) else { return nil }

        // Build directed adjacency with edge info
        var adjacency: [String: [(String, CitationEdge)]] = [:]
        for citation in citations {
            let citing = paperMap[citation.citingPaperId]
            let cited = paperMap[citation.citedPaperId]
            let edge = CitationEdge(
                citingPaperId: citation.citingPaperId,
                citedPaperId: citation.citedPaperId,
                citingTitle: citing?.title ?? citation.citingPaperId,
                citedTitle: cited?.title ?? citation.citedPaperId,
                context: citation.context
            )
            adjacency[citation.citingPaperId, default: []].append((citation.citedPaperId, edge))
        }

        // BFS (uniform weight = 1)
        var queue: [String] = [fromPaperId]
        var visited: Set<String> = [fromPaperId]
        var parent: [String: (String, CitationEdge)] = [:]

        while !queue.isEmpty {
            let current = queue.removeFirst()
            if current == toPaperId { break }

            for (neighbor, edge) in adjacency[current, default: []] {
                if !visited.contains(neighbor) {
                    visited.insert(neighbor)
                    parent[neighbor] = (current, edge)
                    queue.append(neighbor)
                }
            }
        }

        guard parent[toPaperId] != nil else { return nil }

        // Reconstruct path
        var pathNodeIds: [String] = []
        var pathEdges: [CitationEdge] = []
        var current = toPaperId
        while current != fromPaperId {
            pathNodeIds.append(current)
            guard let (prev, edge) = parent[current] else { break }
            pathEdges.append(edge)
            current = prev
        }
        pathNodeIds.append(fromPaperId)
        pathNodeIds.reverse()
        pathEdges.reverse()

        let resultNodes = pathNodeIds.compactMap { id -> CitationGraphNode? in
            guard let p = paperMap[id] else { return nil }
            return CitationGraphNode(paperId: p.id, title: p.title, year: p.year, venue: p.venue)
        }

        return CitationPathResult(nodes: resultNodes, edges: pathEdges, length: pathEdges.count)
    }

    // MARK: - Subgraph

    func subgraph(seedPaperIds: [String], radius: Int = 1, maxNodes: Int = 16) throws -> CitationSubgraph {
        let snapshot = try repo.graphSnapshot()
        let citations = snapshot.citations
        let paperMap = Dictionary(uniqueKeysWithValues: snapshot.papers.map { ($0.id, $0) })

        // Build bidirectional adjacency (for BFS exploration)
        var adjacency: [String: Set<String>] = [:]
        for citation in citations {
            adjacency[citation.citingPaperId, default: []].insert(citation.citedPaperId)
            adjacency[citation.citedPaperId, default: []].insert(citation.citingPaperId)
        }

        let seeds = Array(Set(seedPaperIds.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }))
        guard !seeds.isEmpty, maxNodes > 0 else {
            return CitationSubgraph(nodes: [], edges: [])
        }

        var visited: Set<String> = Set(seeds)
        var currentLevel: Set<String> = Set(seeds)
        var depth = 0
        let effectiveRadius = min(radius, 4)
        let effectiveMaxNodes = max(1, maxNodes)

        while depth < effectiveRadius && visited.count < effectiveMaxNodes {
            var nextLevel: Set<String> = []
            for node in currentLevel {
                for neighbor in adjacency[node, default: []] {
                    if !visited.contains(neighbor) && visited.count < effectiveMaxNodes {
                        visited.insert(neighbor)
                        nextLevel.insert(neighbor)
                    }
                }
            }
            if nextLevel.isEmpty { break }
            currentLevel = nextLevel
            depth += 1
        }

        // Build edges for visited nodes (directed, deduplicated)
        var edgeKeys: Set<String> = []
        var resultEdges: [CitationEdge] = []
        for citation in citations {
            guard visited.contains(citation.citingPaperId), visited.contains(citation.citedPaperId) else { continue }
            let key = citation.citingPaperId + "->" + citation.citedPaperId
            guard !edgeKeys.contains(key) else { continue }
            edgeKeys.insert(key)
            let citing = paperMap[citation.citingPaperId]
            let cited = paperMap[citation.citedPaperId]
            resultEdges.append(CitationEdge(
                citingPaperId: citation.citingPaperId,
                citedPaperId: citation.citedPaperId,
                citingTitle: citing?.title ?? citation.citingPaperId,
                citedTitle: cited?.title ?? citation.citedPaperId,
                context: citation.context
            ))
        }

        let resultNodes = visited.compactMap { id -> CitationGraphNode? in
            guard let p = paperMap[id] else { return nil }
            return CitationGraphNode(paperId: p.id, title: p.title, year: p.year, venue: p.venue)
        }.sorted {
            if $0.year != $1.year {
                return ($0.year ?? 0) > ($1.year ?? 0)
            }
            return $0.title < $1.title
        }

        let sortedEdges = resultEdges.sorted {
            if $0.citingTitle != $1.citingTitle {
                return $0.citingTitle < $1.citingTitle
            }
            return $0.citedTitle < $1.citedTitle
        }

        return CitationSubgraph(nodes: resultNodes, edges: sortedEdges)
    }
}
