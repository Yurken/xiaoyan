import Foundation
import SwiftUI

enum WorkbenchTone: String {
    case blue, green, amber, rust
}

struct WorkbenchMetric {
    let label: String
    let value: String
    let note: String
}

struct WorkbenchLinkAction {
    let label: String
    let route: AppRoute
}

struct WorkbenchAgendaItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let tone: WorkbenchTone
    let action: WorkbenchLinkAction
}

struct WorkbenchInterestItem: Identifiable {
    let id: String
    let title: String
    let stage: String
    let stageTone: WorkbenchTone
    let summary: String
    let nextStep: String
    let stats: [String]
    let action: WorkbenchLinkAction
}

struct WorkbenchHandoffItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let tone: WorkbenchTone
    let action: WorkbenchLinkAction
}

struct WorkbenchRiskItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let tone: WorkbenchTone
    let action: WorkbenchLinkAction
}

struct WorkbenchAssetItem: Identifiable {
    let id: String
    let label: String
    let title: String
    let description: String
    let action: WorkbenchLinkAction
}

struct WorkbenchOverviewModel {
    let heroTitle: String
    let heroDescription: String
    let primaryAction: WorkbenchLinkAction
    let secondaryAction: WorkbenchLinkAction
    let metrics: [WorkbenchMetric]
    let summaryItems: [WorkbenchSummaryItem]
    let agenda: [WorkbenchAgendaItem]
    let interests: [WorkbenchInterestItem]
    let handoffs: [WorkbenchHandoffItem]
    let risks: [WorkbenchRiskItem]
    let assets: [WorkbenchAssetItem]
}

struct WorkbenchSummaryItem {
    let title: String
    let description: String
}

// MARK: - Builder

struct WorkbenchBuilder {
    let papers: [Paper]
    let interests: [ResearchInterest]
    let notes: [KnowledgeNote]
    let sessions: [ChatSession]
    let submissionStats: SubmissionRepository.SubmissionStats

    private let dayMs: TimeInterval = 24 * 60 * 60

    func build() -> WorkbenchOverviewModel {
        let snapshots = buildInterestSnapshots()
        let analyzedCount = papers.filter { $0.analysis != nil }.count
        let primaryAction = snapshots.first?.action ?? WorkbenchLinkAction(label: "开始研究规划", route: .planner)

        return WorkbenchOverviewModel(
            heroTitle: snapshots.isEmpty ? "先把第一个研究主题建立起来。" : "今天先把最关键的研究接上。",
            heroDescription: snapshots.isEmpty
                ? "从研究问题、关键词和目标开始，小妍会先帮你搭起路线，再把论文、知识和对话逐步接回来。"
                : "小妍先把值得继续的主题、刚交回来的结果和容易拖慢进展的事项整理到一起，让你回到首页就知道下一步。",
            primaryAction: primaryAction,
            secondaryAction: WorkbenchLinkAction(label: "打开小妍", route: .copilot),
            metrics: [
                WorkbenchMetric(
                    label: "在研主题",
                    value: String(interests.count),
                    note: "\(snapshots.filter { $0.interest.status == "planned" }.count) 个已成路线"
                ),
                WorkbenchMetric(
                    label: "已解读论文",
                    value: String(analyzedCount),
                    note: "\(papers.count) 篇论文已入库"
                ),
                WorkbenchMetric(
                    label: "知识卡片",
                    value: String(notes.count),
                    note: "可继续补证据和结构"
                ),
                WorkbenchMetric(
                    label: "最近对话",
                    value: String(sessions.count),
                    note: "可以直接接着追问"
                ),
            ],
            summaryItems: buildSummaryItems(snapshots: snapshots),
            agenda: buildAgenda(snapshots: snapshots),
            interests: snapshots.prefix(4).map { snapshot in
                WorkbenchInterestItem(
                    id: snapshot.interest.id,
                    title: snapshot.title,
                    stage: snapshot.stage,
                    stageTone: snapshot.stageTone,
                    summary: snapshot.summary,
                    nextStep: snapshot.nextStep,
                    stats: snapshot.stats,
                    action: snapshot.action
                )
            },
            handoffs: buildHandoffs(),
            risks: buildRisks(),
            assets: buildAssets(snapshots: snapshots)
        )
    }

    // MARK: - Interest Snapshots

    private struct InterestSnapshot {
        let interest: ResearchInterest
        let title: String
        let notes: [KnowledgeNote]
        let analyzedCount: Int
        let recentAt: TimeInterval
        let score: Int
        let stage: String
        let stageTone: WorkbenchTone
        let summary: String
        let nextStep: String
        let action: WorkbenchLinkAction
        let stats: [String]
    }

    private func buildInterestSnapshots() -> [InterestSnapshot] {
        let now = Date().timeIntervalSince1970
        var results: [InterestSnapshot] = []
        for interest in interests {
            results.append(buildSnapshot(interest: interest, now: now))
        }
        return results.sorted {
            if $0.score != $1.score { return $0.score > $1.score }
            return $0.recentAt > $1.recentAt
        }
    }

    private func buildSnapshot(interest: ResearchInterest, now: TimeInterval) -> InterestSnapshot {
        let interestPapers = papers.filter { $0.researchInterestId == interest.id }
        let interestNotes = notes.filter { $0.researchInterestId == interest.id }
        let interestSessions = sessions.filter { $0.contextType == "interest" && $0.contextId == interest.id }
        let analyzed = interestPapers.filter { $0.analysis != nil }.count

        let paperTimes = interestPapers.map { $0.updatedAt?.timeIntervalSince1970 ?? $0.createdAt.timeIntervalSince1970 }
        let noteTimes = interestNotes.map { $0.updatedAt?.timeIntervalSince1970 ?? $0.createdAt?.timeIntervalSince1970 ?? 0 }
        let sessionTimes = interestSessions.map { $0.createdAt?.timeIntervalSince1970 ?? 0 }
        let recentAt = [
            interest.createdAt?.timeIntervalSince1970,
            paperTimes.max(),
            noteTimes.max(),
            sessionTimes.max(),
        ].compactMap { $0 }.max() ?? 0

        let status = interest.status ?? ""
        let stageInfo = interestStage(status: status, papers: interestPapers, analyzed: analyzed, notes: interestNotes, sessions: interestSessions)

        var score = status == "planned" ? 6 : status == "planning" ? 3 : 1
        score += min(interestPapers.count, 3) * 2
        score += min(analyzed, 2) * 2
        score += min(interestNotes.count, 3) * 2
        score += min(interestSessions.count, 3)
        if now - recentAt <= 3 * dayMs { score += 3 }
        else if now - recentAt <= 7 * dayMs { score += 1 }

        return InterestSnapshot(
            interest: interest,
            title: interest.folderName?.trimmingCharacters(in: .whitespaces) ?? interest.topic,
            notes: interestNotes,
            analyzedCount: analyzed,
            recentAt: recentAt,
            score: score,
            stage: stageInfo.stage,
            stageTone: stageInfo.tone,
            summary: stageInfo.summary,
            nextStep: stageInfo.nextStep,
            action: stageInfo.action,
            stats: [
                "\(interestPapers.count) 篇论文",
                "\(interestNotes.count) 条笔记",
                "\(interestSessions.count) 次对话",
            ]
        )
    }

    private struct StageInfo {
        let stage: String
        let tone: WorkbenchTone
        let summary: String
        let nextStep: String
        let action: WorkbenchLinkAction
    }

    private func interestStage(status: String, papers: [Paper], analyzed: Int, notes: [KnowledgeNote], sessions: [ChatSession]) -> StageInfo {
        if status == "planning" {
            return StageInfo(
                stage: "路线生成中",
                tone: .blue,
                summary: "小妍正在整理研究路线、核心问题和切入方向。",
                nextStep: "先等路线生成完成，再决定优先补哪篇论文。",
                action: WorkbenchLinkAction(label: "去规划", route: .planner)
            )
        }
        if status == "planned" && papers.isEmpty {
            return StageInfo(
                stage: "补核心论文",
                tone: .amber,
                summary: "路线已经成形，但还没有和这个主题关联的核心论文。",
                nextStep: "先导入 1 篇最能代表问题边界的论文。",
                action: WorkbenchLinkAction(label: "去论文", route: .papers)
            )
        }
        if status == "planned" && analyzed == 0 {
            return StageInfo(
                stage: "论文精读",
                tone: .blue,
                summary: "已经关联 \(papers.count) 篇论文，下一步先完成首篇解读。",
                nextStep: "先让小妍把一篇核心论文解读清楚。",
                action: WorkbenchLinkAction(label: "看论文", route: .papers)
            )
        }
        if status == "planned" && notes.isEmpty {
            return StageInfo(
                stage: "沉淀知识",
                tone: .green,
                summary: "已有 \(analyzed) 篇论文完成解读，但还没有对应的知识卡片。",
                nextStep: "把关键结论和证据先沉淀成第一条知识卡片。",
                action: WorkbenchLinkAction(label: "去知识", route: .knowledge)
            )
        }
        if status == "planned" && sessions.isEmpty {
            return StageInfo(
                stage: "继续追问",
                tone: .green,
                summary: "这个主题已经有论文和知识沉淀，可以开始围绕问题继续追问。",
                nextStep: "带着现有材料继续和小妍讨论下一步。",
                action: WorkbenchLinkAction(label: "问小妍", route: .copilot)
            )
        }
        if status == "planned" {
            return StageInfo(
                stage: "持续推进",
                tone: .blue,
                summary: "已有 \(papers.count) 篇论文、\(notes.count) 条笔记和 \(sessions.count) 次对话沉淀。",
                nextStep: "继续收敛问题、补证据，并安排下一步实验或写作。",
                action: WorkbenchLinkAction(label: "继续推进", route: .copilot)
            )
        }
        return StageInfo(
            stage: "等待规划",
            tone: .amber,
            summary: "这个主题还没有形成稳定路线。",
            nextStep: "先把研究目标、关键词和预期产出整理清楚。",
            action: WorkbenchLinkAction(label: "去规划", route: .planner)
        )
    }

    // MARK: - Agenda

    private func buildAgenda(snapshots: [InterestSnapshot]) -> [WorkbenchAgendaItem] {
        var items: [WorkbenchAgendaItem] = []

        if submissionStats.pendingReviews > 0 {
            items.append(WorkbenchAgendaItem(
                id: "submission-pending-reviews",
                label: "先处理时效任务",
                title: "\(submissionStats.pendingReviews) 条审稿意见待回复",
                description: "这类任务最容易影响节奏，建议先在投稿页确认当前轮次和回复计划。",
                tone: .rust,
                action: WorkbenchLinkAction(label: "去投稿", route: .submission)
            ))
        }

        if let nearest = submissionStats.upcomingDdls.sorted(by: { $0.deadline < $1.deadline }).first {
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "zh_CN")
            fmt.dateFormat = "MM-dd"
            items.append(WorkbenchAgendaItem(
                id: "submission-ddl-\(nearest.name)",
                label: "最近截止",
                title: "确认 \(nearest.name) 的截止安排",
                description: "\(fmt.string(from: nearest.deadline)) 有一个临近节点，建议提前把版本和材料整理好。",
                tone: .amber,
                action: WorkbenchLinkAction(label: "看截止", route: .submission)
            ))
        }

        if let top = snapshots.first {
            items.append(WorkbenchAgendaItem(
                id: "interest-next-\(top.interest.id)",
                label: top.stage,
                title: "继续推进「\(top.title)」",
                description: top.nextStep,
                tone: top.stageTone,
                action: top.action
            ))
        }

        if let gap = snapshots.first(where: {
            ($0.interest.status ?? "") == "planned" && $0.analyzedCount > 0 && $0.notes.isEmpty
        }), gap.interest.id != snapshots.first?.interest.id {
            items.append(WorkbenchAgendaItem(
                id: "knowledge-gap-\(gap.interest.id)",
                label: "补知识沉淀",
                title: "给「\(gap.title)」补第一条知识卡片",
                description: "有论文解读但没有知识沉淀时，后续追问和写作都会变散。",
                tone: .green,
                action: WorkbenchLinkAction(label: "去知识", route: .knowledge)
            ))
        }

        if items.isEmpty {
            items.append(WorkbenchAgendaItem(
                id: "empty-start",
                label: "先开始",
                title: "先建立第一个研究主题",
                description: "从研究问题、关键词和目标开始，小妍会先帮你把路线搭起来。",
                tone: .blue,
                action: WorkbenchLinkAction(label: "开始规划", route: .planner)
            ))
        }

        return Array(items.prefix(3))
    }

    // MARK: - Handoffs

    private func buildHandoffs() -> [WorkbenchHandoffItem] {
        var items: [WorkbenchHandoffItem] = []
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "zh_CN")
        fmt.dateFormat = "MM-dd HH:mm"

        if let latestPaper = papers
            .filter({ $0.analysis != nil })
            .max(by: { ($0.updatedAt ?? $0.createdAt) < ($1.updatedAt ?? $1.createdAt) }) {
            items.append(WorkbenchHandoffItem(
                id: "handoff-paper-\(latestPaper.id)",
                label: "论文解读",
                title: "小妍刚整理完《\(latestPaper.title)》",
                description: "最近更新于 \(fmt.string(from: latestPaper.updatedAt ?? latestPaper.createdAt))，可以继续查看方法、结论和复现提示。",
                tone: .blue,
                action: WorkbenchLinkAction(label: "查看论文", route: .papers)
            ))
        }

        if let latestNote = notes
            .max(by: { ($0.updatedAt ?? $0.createdAt ?? .distantPast) < ($1.updatedAt ?? $1.createdAt ?? .distantPast) }) {
            items.append(WorkbenchHandoffItem(
                id: "handoff-note-\(latestNote.id)",
                label: "知识沉淀",
                title: "最近沉淀了《\(latestNote.title)》",
                description: "\(fmt.string(from: latestNote.updatedAt ?? latestNote.createdAt ?? Date())) 更新，可以继续补证据或整理结构。",
                tone: .green,
                action: WorkbenchLinkAction(label: "查看知识", route: .knowledge)
            ))
        }

        if let latestSession = sessions
            .max(by: { ($0.createdAt ?? .distantPast) < ($1.createdAt ?? .distantPast) }) {
            items.append(WorkbenchHandoffItem(
                id: "handoff-session-\(latestSession.id)",
                label: "继续对话",
                title: latestSession.title ?? "继续刚才那次对话",
                description: "\(fmt.string(from: latestSession.createdAt ?? Date())) 有过更新，适合直接接着追问。",
                tone: .amber,
                action: WorkbenchLinkAction(label: "打开小妍", route: .copilot)
            ))
        }

        if items.isEmpty {
            items.append(WorkbenchHandoffItem(
                id: "handoff-empty",
                label: "还没有交接",
                title: "先把第一个研究问题交给小妍",
                description: "导入论文、创建主题或开始一段对话后，工作台会逐步把结果交回这里。",
                tone: .blue,
                action: WorkbenchLinkAction(label: "开始规划", route: .planner)
            ))
        }

        return Array(items.prefix(3))
    }

    // MARK: - Risks

    private func buildRisks() -> [WorkbenchRiskItem] {
        let failedPapers = papers.filter { $0.status == .failed }
        let processingPapers = papers.filter { $0.status == .parsing }
        let planningInterests = interests.filter { $0.status == "planning" }
        var items: [WorkbenchRiskItem] = []

        if submissionStats.pendingReviews > 0 {
            items.append(WorkbenchRiskItem(
                id: "risk-pending-reviews",
                label: "待回复",
                title: "\(submissionStats.pendingReviews) 条审稿意见待处理",
                description: "如果不尽早整理回复逻辑，后面的补实验和改稿会一起堆起来。",
                tone: .rust,
                action: WorkbenchLinkAction(label: "去投稿", route: .submission)
            ))
        }

        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "zh_CN")
        fmt.dateFormat = "MM-dd"
        for (index, ddl) in submissionStats.upcomingDdls.prefix(2).enumerated() {
            items.append(WorkbenchRiskItem(
                id: "risk-ddl-\(index)-\(ddl.name)",
                label: "临近截止",
                title: "\(ddl.name) 即将到期",
                description: "\(fmt.string(from: ddl.deadline)) 前建议确认版本、材料和回复节奏。",
                tone: .amber,
                action: WorkbenchLinkAction(label: "查看截止", route: .submission)
            ))
        }

        if !failedPapers.isEmpty {
            items.append(WorkbenchRiskItem(
                id: "risk-failed-papers",
                label: "处理中断",
                title: "\(failedPapers.count) 篇论文处理失败",
                description: "解析或解读失败会直接中断后面的知识沉淀和追问，建议尽快处理。",
                tone: .rust,
                action: WorkbenchLinkAction(label: "去论文", route: .papers)
            ))
        }

        if !processingPapers.isEmpty {
            items.append(WorkbenchRiskItem(
                id: "risk-processing-papers",
                label: "正在处理中",
                title: "\(processingPapers.count) 篇论文仍在处理中",
                description: "可以先去看其他已完成的材料，等处理结束后再继续补知识或追问。",
                tone: .blue,
                action: WorkbenchLinkAction(label: "查看论文", route: .papers)
            ))
        }

        if !planningInterests.isEmpty {
            items.append(WorkbenchRiskItem(
                id: "risk-planning-interests",
                label: "路线待完成",
                title: "\(planningInterests.count) 个主题仍在生成路线",
                description: "路线没成形之前，很容易过早导入不相关论文或把问题边界拉得太散。",
                tone: .amber,
                action: WorkbenchLinkAction(label: "去规划", route: .planner)
            ))
        }

        if items.isEmpty {
            items.append(WorkbenchRiskItem(
                id: "risk-empty",
                label: "当前平稳",
                title: "暂时没有明显阻塞",
                description: "可以优先跟着今日推进继续往前做，不用先回头处理异常。",
                tone: .green,
                action: WorkbenchLinkAction(label: "看今日推进", route: .home)
            ))
        }

        return Array(items.prefix(4))
    }

    // MARK: - Assets

    private func buildAssets(snapshots: [InterestSnapshot]) -> [WorkbenchAssetItem] {
        var items: [WorkbenchAssetItem] = []

        if let latest = snapshots.first {
            items.append(WorkbenchAssetItem(
                id: "asset-interest-\(latest.interest.id)",
                label: "在研主题",
                title: latest.title,
                description: latest.summary,
                action: latest.action
            ))
        }

        if let latestNote = notes
            .max(by: { ($0.updatedAt ?? $0.createdAt ?? .distantPast) < ($1.updatedAt ?? $1.createdAt ?? .distantPast) }) {
            items.append(WorkbenchAssetItem(
                id: "asset-note-\(latestNote.id)",
                label: "知识卡片",
                title: latestNote.title,
                description: String(latestNote.content.prefix(120)),
                action: WorkbenchLinkAction(label: "去知识", route: .knowledge)
            ))
        }

        if let latestPaper = papers
            .max(by: { ($0.updatedAt ?? $0.createdAt) < ($1.updatedAt ?? $1.createdAt) }) {
            let fmt = DateFormatter()
            fmt.locale = Locale(identifier: "zh_CN")
            fmt.dateFormat = "MM-dd"
            items.append(WorkbenchAssetItem(
                id: "asset-paper-\(latestPaper.id)",
                label: "最近论文",
                title: latestPaper.title,
                description: "最近更新于 \(fmt.string(from: latestPaper.updatedAt ?? latestPaper.createdAt))。",
                action: WorkbenchLinkAction(label: "去论文", route: .papers)
            ))
        }

        if items.isEmpty {
            items.append(WorkbenchAssetItem(
                id: "asset-empty",
                label: "暂无沉淀",
                title: "还没有可继续接手的研究资产",
                description: "创建研究主题、导入论文或开始一段对话后，这里会逐步积累起研究脉络。",
                action: WorkbenchLinkAction(label: "开始规划", route: .planner)
            ))
        }

        return Array(items.prefix(3))
    }

    // MARK: - Summary Items

    private func buildSummaryItems(snapshots: [InterestSnapshot]) -> [WorkbenchSummaryItem] {
        let pending = submissionStats.pendingReviews
        return [
            WorkbenchSummaryItem(
                title: pending > 0 ? "投稿链里有待处理事项" : "投稿链当前相对平稳",
                description: pending > 0
                    ? "\(pending) 条审稿意见待回复，建议优先确认时效任务。"
                    : (!submissionStats.upcomingDdls.isEmpty
                        ? "\(submissionStats.upcomingDdls.count) 个截止节点待关注，记得提前整理版本。"
                        : "当前没有明显的投稿阻塞，可以把精力放回研究推进本身。")
            ),
            WorkbenchSummaryItem(
                title: snapshots.first != nil ? "优先继续「\(snapshots.first!.title)」" : "先从研究规划开始",
                description: snapshots.first?.nextStep ?? "先把研究问题、关键词和预期产出整理清楚。"
            ),
            WorkbenchSummaryItem(
                title: notes.isEmpty ? "还需要把研究结论沉淀下来" : "已有可继续接手的知识沉淀",
                description: notes.isEmpty
                    ? "等论文解读后，建议尽快把关键结论沉淀成知识卡片，后续追问会更稳。"
                    : "已经有知识卡片可继续补证据、改结构，不用每次都从对话历史里回找。"
            ),
        ]
    }
}

// MARK: - Tone Helpers

extension WorkbenchTone {
    var badgeColor: Color {
        switch self {
        case .blue: return .blue
        case .green: return .green
        case .amber: return .orange
        case .rust: return .red
        }
    }

    var backgroundColor: Color {
        switch self {
        case .blue: return Color.blue.opacity(0.12)
        case .green: return Color.green.opacity(0.12)
        case .amber: return Color.orange.opacity(0.12)
        case .rust: return Color.red.opacity(0.12)
        }
    }
}
