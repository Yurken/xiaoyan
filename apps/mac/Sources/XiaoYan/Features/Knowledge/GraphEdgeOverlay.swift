import SwiftUI

struct NodeAnchorKey: PreferenceKey {
    static var defaultValue: [String: Anchor<CGRect>] = [:]
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { _, new in new }
    }
}

struct GraphEdgeOverlay: View {
    let evidenceLinks: [EvidenceLink]
    let citations: [PaperCitation]
    let nodeAnchors: [String: Anchor<CGRect>]

    var body: some View {
        GeometryReader { proxy in
            let rects = nodeAnchors.compactMapValues { proxy[$0] }

            ZStack {
                // Evidence edges: solid green
                Path { path in
                    for link in evidenceLinks {
                        guard let claimRect = rects[link.claimId],
                              let sourceRect = rects[link.sourceId] else { continue }
                        let start = CGPoint(x: claimRect.midX, y: claimRect.midY)
                        let end = CGPoint(x: sourceRect.midX, y: sourceRect.midY)
                        path.move(to: start)
                        path.addQuadCurve(to: end, control: controlPoint(start: start, end: end))
                    }
                }
                .stroke(Color.green.opacity(0.7), style: StrokeStyle(lineWidth: 1.8, lineCap: .round))

                // Citation edges: dashed purple
                Path { path in
                    for citation in citations {
                        guard let citingRect = rects[citation.citingPaperId],
                              let citedRect = rects[citation.citedPaperId] else { continue }
                        let start = CGPoint(x: citingRect.midX, y: citingRect.midY)
                        let end = CGPoint(x: citedRect.midX, y: citedRect.midY)
                        path.move(to: start)
                        path.addQuadCurve(to: end, control: controlPoint(start: start, end: end))
                    }
                }
                .stroke(Color.purple.opacity(0.6), style: StrokeStyle(lineWidth: 1.4, lineCap: .round, dash: [6, 5]))
            }
        }
    }

    private func controlPoint(start: CGPoint, end: CGPoint) -> CGPoint {
        let midX = (start.x + end.x) / 2
        let midY = (start.y + end.y) / 2
        let dx = abs(end.x - start.x)
        let offset = min(dx * 0.3, 80)
        return CGPoint(x: midX, y: midY - offset)
    }
}
