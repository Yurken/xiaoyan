import Foundation
import SwiftUI

enum CanvasTool: String, CaseIterable {
    case none
    case addClaim
    case linkEvidence
    case linkCitation

    var label: String {
        switch self {
        case .none: return "选择"
        case .addClaim: return "+ 论断"
        case .linkEvidence: return "+ 证据"
        case .linkCitation: return "+ 引用"
        }
    }

    var icon: String {
        switch self {
        case .none: return "cursorarrow"
        case .addClaim: return "plus.bubble"
        case .linkEvidence: return "link.badge.plus"
        case .linkCitation: return "arrow.right.doc.on.clipboard"
        }
    }
}

/// 工具激活时单击节点的合法性判定
enum NodeTargetability {
    case neutral
    case validSource
    case validTarget
    case invalid
}

/// 拉线工具单击节点的产物
enum CanvasPickResult {
    case sourcePicked
    case readyForSheet(source: GraphNode, target: GraphNode)
    case invalidNode
}

@MainActor
final class KnowledgeGraphEditor: ObservableObject {
    @Published var isEditing: Bool = false
    @Published var activeTool: CanvasTool = .none
    @Published var pendingSource: GraphNode? = nil
    @Published var hint: String? = nil

    func toggleEdit() {
        isEditing.toggle()
        if !isEditing {
            cancelTool()
        }
    }

    func startTool(_ tool: CanvasTool) {
        activeTool = tool
        pendingSource = nil
        hint = Self.entryHint(for: tool)
    }

    func cancelTool() {
        activeTool = .none
        pendingSource = nil
        hint = nil
    }

    /// 拉线工具单击节点时调用。
    /// addClaim 工具不走这个路径（直接弹 sheet）。
    func pickNode(_ node: GraphNode) -> CanvasPickResult {
        switch activeTool {
        case .none, .addClaim:
            return .invalidNode
        case .linkEvidence:
            return pickForEvidence(node)
        case .linkCitation:
            return pickForCitation(node)
        }
    }

    private func pickForEvidence(_ node: GraphNode) -> CanvasPickResult {
        if pendingSource == nil {
            // 第一步：必须是 claim
            guard node.type == .claim else {
                hint = "请先点击一个论断节点作为起点"
                return .invalidNode
            }
            pendingSource = node
            hint = "已选论断《\(node.label)》— 再点击一个论文/笔记/实验作为证据"
            return .sourcePicked
        }
        // 第二步：必须是 paper / note / experiment
        guard let source = pendingSource else { return .invalidNode }
        guard [.paper, .note, .experiment].contains(node.type) else {
            hint = "证据节点必须是论文/笔记/实验"
            return .invalidNode
        }
        return .readyForSheet(source: source, target: node)
    }

    private func pickForCitation(_ node: GraphNode) -> CanvasPickResult {
        if pendingSource == nil {
            guard node.type == .paper else {
                hint = "请先点击一篇论文作为引用方"
                return .invalidNode
            }
            pendingSource = node
            hint = "已选论文《\(node.label)》— 再点击一篇被引用的论文"
            return .sourcePicked
        }
        guard let source = pendingSource else { return .invalidNode }
        guard node.type == .paper else {
            hint = "被引用方必须也是论文"
            return .invalidNode
        }
        guard node.id != source.id else {
            hint = "不能引用自身"
            return .invalidNode
        }
        return .readyForSheet(source: source, target: node)
    }

    /// 计算节点在当前工具下的可达性（用于卡片高亮）
    func targetability(for node: GraphNode) -> NodeTargetability {
        guard isEditing else { return .neutral }
        switch activeTool {
        case .none, .addClaim:
            return .neutral
        case .linkEvidence:
            return targetabilityForEvidence(node)
        case .linkCitation:
            return targetabilityForCitation(node)
        }
    }

    private func targetabilityForEvidence(_ node: GraphNode) -> NodeTargetability {
        if let source = pendingSource {
            if node.id == source.id { return .validSource }
            return [.paper, .note, .experiment].contains(node.type) ? .validTarget : .invalid
        }
        return node.type == .claim ? .validSource : .invalid
    }

    private func targetabilityForCitation(_ node: GraphNode) -> NodeTargetability {
        if let source = pendingSource {
            if node.id == source.id { return .validSource }
            return node.type == .paper ? .validTarget : .invalid
        }
        return node.type == .paper ? .validSource : .invalid
    }

    private static func entryHint(for tool: CanvasTool) -> String? {
        switch tool {
        case .none: return nil
        case .addClaim: return "正在新增论断..."
        case .linkEvidence: return "请点击一个论断节点作为起点"
        case .linkCitation: return "请点击一篇引用方论文"
        }
    }
}
