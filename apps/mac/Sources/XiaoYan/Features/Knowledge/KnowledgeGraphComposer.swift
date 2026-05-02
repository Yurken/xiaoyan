import SwiftUI

enum ComposerMode: String, CaseIterable {
    case claim = "论断"
    case evidence = "证据"
    case citation = "引用"
}

struct KnowledgeGraphComposer: View {
    let initialMode: ComposerMode
    let snapshot: KnowledgeGraphSnapshot?
    var onChanged: () -> Void
    var onClose: () -> Void = {}

    @State private var mode: ComposerMode
    @State private var busy = false
    @State private var errorMessage: String?

    // Claim form
    @State private var claimTitle = ""
    @State private var claimStatement = ""
    @State private var claimStatus: KnowledgeClaimStatus = .hypothesis
    @State private var claimInterestId: String?

    // Evidence form
    @State private var evClaimId = ""
    @State private var evSourceKind = "paper"
    @State private var evSourceId = ""
    @State private var evRelation: RelationKind = .supports
    @State private var evSummary = ""

    // Citation form
    @State private var citCitingId = ""
    @State private var citCitedId = ""
    @State private var citContext = ""

    private let repo = KnowledgeRepository()

    init(
        initialMode: ComposerMode,
        snapshot: KnowledgeGraphSnapshot?,
        onChanged: @escaping () -> Void,
        onClose: @escaping () -> Void = {}
    ) {
        self.initialMode = initialMode
        self.snapshot = snapshot
        self.onChanged = onChanged
        self.onClose = onClose
        _mode = State(initialValue: initialMode)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("模式", selection: $mode) {
                    ForEach(ComposerMode.allCases, id: \.self) { m in
                        Text(m.rawValue).tag(m)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)

                Spacer()

                if busy {
                    ProgressView()
                        .controlSize(.small)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .lineLimit(1)
                }

                Button(action: onClose) {
                    Image(systemName: "xmark.circle")
                        .font(.body)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.borderless)
                .help("收起")
            }
            .padding(.horizontal)
            .padding(.top, 10)

            Form {
                switch mode {
                case .claim: claimForm
                case .evidence: evidenceForm
                case .citation: citationForm
                }
            }
            .formStyle(.grouped)
            .padding(.bottom, 4)

            HStack {
                Button("重置") { resetForm() }
                    .buttonStyle(.borderless)
                Spacer()
                Button("创建") { submit() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(!canSubmit || busy)
            }
            .padding(.horizontal)
            .padding(.bottom, 10)
        }
        .frame(height: 260)
        .background(Color(nsColor: .controlBackgroundColor))
        .onChange(of: mode) { _, _ in resetForm() }
        .onAppear { resetForm() }
    }

    // MARK: - Forms

    @ViewBuilder
    private var claimForm: some View {
        TextField("标题", text: $claimTitle)
        TextField("论断陈述", text: $claimStatement, axis: .vertical)
            .lineLimit(2...4)
        Picker("状态", selection: $claimStatus) {
            ForEach(KnowledgeClaimStatus.allCases, id: \.self) { s in
                Text(s.displayName).tag(s)
            }
        }
        if let interests = snapshot?.interests, !interests.isEmpty {
            Picker("研究方向（可选）", selection: $claimInterestId) {
                Text("无").tag(String?.none)
                ForEach(interests) { i in
                    Text(i.topic).tag(Optional(i.id))
                }
            }
        }
    }

    @ViewBuilder
    private var evidenceForm: some View {
        let claims = snapshot?.claims ?? []
        if !claims.isEmpty {
            Picker("论断", selection: $evClaimId) {
                ForEach(claims) { c in
                    Text(c.title).tag(c.id)
                }
            }
        } else {
            Text("暂无论断可选")
                .font(.caption)
                .foregroundStyle(.secondary)
        }

        Picker("来源类型", selection: $evSourceKind) {
            Text("论文").tag("paper")
            Text("笔记").tag("note")
            Text("实验").tag("experiment")
        }

        let sources = availableSources(kind: evSourceKind)
        if !sources.isEmpty {
            Picker("来源", selection: $evSourceId) {
                ForEach(sources, id: \.id) { s in
                    Text(s.label).tag(s.id)
                }
            }
        } else {
            Text("该类型下暂无来源")
                .font(.caption)
                .foregroundStyle(.secondary)
        }

        Picker("关系", selection: $evRelation) {
            Text("支持").tag(RelationKind.supports)
            Text("反驳").tag(RelationKind.contradicts)
            Text("背景").tag(RelationKind.background)
        }

        TextField("证据摘要（可选）", text: $evSummary, axis: .vertical)
            .lineLimit(2...4)
    }

    @ViewBuilder
    private var citationForm: some View {
        let papers = snapshot?.papers ?? []
        if papers.count >= 2 {
            Picker("引用方", selection: $citCitingId) {
                ForEach(papers) { p in
                    Text(p.title).tag(p.id)
                }
            }
            Picker("被引用", selection: $citCitedId) {
                ForEach(papers) { p in
                    Text(p.title).tag(p.id)
                }
            }
            TextField("引用上下文（可选）", text: $citContext, axis: .vertical)
                .lineLimit(2...4)
        } else {
            Text("至少需要 2 篇论文才能建立引用关系")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Helpers

    private struct SourceOption: Identifiable {
        let id: String
        let label: String
    }

    private func availableSources(kind: String) -> [SourceOption] {
        switch kind {
        case "paper": return snapshot?.papers.map { SourceOption(id: $0.id, label: $0.title) } ?? []
        case "note": return snapshot?.notes.map { SourceOption(id: $0.id, label: $0.title) } ?? []
        case "experiment": return snapshot?.experiments.map { SourceOption(id: $0.id, label: $0.title) } ?? []
        default: return []
        }
    }

    private var canSubmit: Bool {
        switch mode {
        case .claim:
            return !claimTitle.trimmingCharacters(in: .whitespaces).isEmpty
                && !claimStatement.trimmingCharacters(in: .whitespaces).isEmpty
        case .evidence:
            return !evClaimId.isEmpty && !evSourceId.isEmpty
        case .citation:
            let papers = snapshot?.papers ?? []
            return !citCitingId.isEmpty && !citCitedId.isEmpty && citCitingId != citCitedId
                && papers.count >= 2
        }
    }

    private func submit() {
        busy = true
        errorMessage = nil
        defer { busy = false }

        do {
            switch mode {
            case .claim:
                let claim = KnowledgeClaim(
                    id: UUID().uuidString,
                    title: claimTitle.trimmingCharacters(in: .whitespacesAndNewlines),
                    statement: claimStatement.trimmingCharacters(in: .whitespacesAndNewlines),
                    researchInterestId: claimInterestId,
                    status: claimStatus.rawValue,
                    createdAt: Date()
                )
                try repo.insertClaim(claim)
                resetClaimForm()

            case .evidence:
                if try repo.evidenceLinkExists(
                    claimId: evClaimId,
                    sourceKind: evSourceKind,
                    sourceId: evSourceId,
                    relationKind: evRelation.rawValue
                ) {
                    errorMessage = "已绑定相同关系，无需重复添加"
                    return
                }
                let link = EvidenceLink(
                    id: UUID().uuidString,
                    claimId: evClaimId,
                    sourceKind: evSourceKind,
                    sourceId: evSourceId,
                    relationKind: evRelation.rawValue,
                    evidenceSummary: evSummary.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                )
                try repo.insertEvidenceLink(link)
                resetEvidenceForm()

            case .citation:
                if try repo.citationExists(citingPaperId: citCitingId, citedPaperId: citCitedId) {
                    errorMessage = "已记录此引用关系，无需重复添加"
                    return
                }
                let citation = PaperCitation(
                    id: UUID().uuidString,
                    citingPaperId: citCitingId,
                    citedPaperId: citCitedId,
                    context: citContext.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
                )
                try repo.insertCitation(citation)
                resetCitationForm()
            }
            onChanged()
        } catch {
            errorMessage = "保存失败：\(error.localizedDescription)"
        }
    }

    private func resetForm() {
        switch mode {
        case .claim: resetClaimForm()
        case .evidence: resetEvidenceForm()
        case .citation: resetCitationForm()
        }
        errorMessage = nil
    }

    private func resetClaimForm() {
        claimTitle = ""
        claimStatement = ""
        claimStatus = .hypothesis
        claimInterestId = nil
    }

    private func resetEvidenceForm() {
        let claims = snapshot?.claims ?? []
        evClaimId = claims.first?.id ?? ""
        evSourceKind = "paper"
        evSourceId = ""
        evRelation = .supports
        evSummary = ""
    }

    private func resetCitationForm() {
        let papers = snapshot?.papers ?? []
        citCitingId = papers.first?.id ?? ""
        citCitedId = papers.dropFirst().first?.id ?? ""
        citContext = ""
    }
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : self
    }
}
