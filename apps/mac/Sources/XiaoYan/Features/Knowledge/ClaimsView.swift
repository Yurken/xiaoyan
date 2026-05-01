import SwiftUI

struct ClaimsView: View {
    @State private var claims: [KnowledgeClaim] = []
    @State private var selectedClaim: KnowledgeClaim?
    @State private var showingCreate = false
    @State private var searchText = ""
    private let repo = KnowledgeRepository()

    var filteredClaims: [KnowledgeClaim] {
        if searchText.isEmpty { return claims }
        let q = searchText.lowercased()
        return claims.filter {
            $0.title.lowercased().contains(q) ||
            $0.statement.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationSplitView {
            VStack(spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("搜索论断...", text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(8)
                .background(Theme.Colors.surface)
                .cornerRadius(Theme.Radii.medium)
                .nmShadow(level: Theme.Shadows.soft)
                .padding()

                if filteredClaims.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "lightbulb")
                            .font(.system(size: 36))
                            .foregroundStyle(.secondary)
                        Text(searchText.isEmpty ? "还没有研究论断" : "没有找到相关论断")
                            .font(.subheadline.bold())
                        if searchText.isEmpty {
                            Text("记录核心研究论断，并关联支撑证据")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List(filteredClaims, selection: $selectedClaim) { claim in
                        ClaimRow(claim: claim)
                            .tag(claim)
                    }
                    .listStyle(.sidebar)
                }
            }
            .navigationTitle("研究论断")
            .toolbar {
                ToolbarItem {
                    Button(action: { showingCreate = true }) {
                        Label("新建论断", systemImage: "plus")
                    }
                }
            }
        } detail: {
            if let claim = selectedClaim {
                ClaimDetailView(claim: claim, onUpdate: reload)
            } else {
                ContentUnavailableView("选择论断", systemImage: "lightbulb")
            }
        }
        .onAppear(perform: reload)
        .sheet(isPresented: $showingCreate) {
            CreateClaimSheet { _ in reload() }
        }
    }

    private func reload() {
        claims = (try? repo.listClaims()) ?? []
        if let selected = selectedClaim {
            selectedClaim = claims.first { $0.id == selected.id }
        }
    }
}

// MARK: - Row

private struct ClaimRow: View {
    let claim: KnowledgeClaim

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(claim.title)
                .font(.subheadline.bold())
                .lineLimit(1)
            Text(claim.statement)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack {
                if let status = KnowledgeClaimStatus.from(claim.status) {
                    Text(status.displayName)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(statusColor(status).opacity(0.12))
                        .foregroundColor(statusColor(status))
                        .cornerRadius(4)
                }
                Spacer()
                if let date = claim.createdAt {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    private func statusColor(_ status: KnowledgeClaimStatus) -> Color {
        switch status {
        case .supported: return .green
        case .contested: return .red
        case .hypothesis: return .orange
        case .open: return .blue
        }
    }
}

// MARK: - Detail

private struct ClaimDetailView: View {
    let claim: KnowledgeClaim
    let onUpdate: () -> Void
    @State private var isEditing = false
    @State private var editTitle = ""
    @State private var editStatement = ""
    @State private var editStatus: KnowledgeClaimStatus = .hypothesis
    @State private var evidence: [EvidenceLink] = []
    @State private var sourceTitles: [String: String] = [:]
    private let repo = KnowledgeRepository()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    if isEditing {
                        TextField("标题", text: $editTitle)
                            .font(.title2.bold())
                            .textFieldStyle(.plain)
                    } else {
                        Text(claim.title)
                            .font(.title2.bold())
                    }
                    Spacer()
                    Button(isEditing ? "保存" : "编辑") {
                        if isEditing { save() } else { startEdit() }
                    }
                    .buttonStyle(.bordered)
                }

                if isEditing {
                    Picker("状态", selection: $editStatus) {
                        ForEach(KnowledgeClaimStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                } else if let status = KnowledgeClaimStatus.from(claim.status) {
                    Text(status.displayName)
                        .font(.caption2.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(statusColor(status).opacity(0.12))
                        .foregroundColor(statusColor(status))
                        .cornerRadius(4)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("论断陈述")
                        .font(.headline)
                    if isEditing {
                        TextEditor(text: $editStatement)
                            .font(.body)
                            .frame(minHeight: 100)
                            .padding(4)
                            .background(Theme.Colors.surface)
                            .cornerRadius(Theme.Radii.medium)
                            .nmShadow(level: Theme.Shadows.soft)
                    } else {
                        Text(claim.statement)
                            .font(.body)
                            .textSelection(.enabled)
                    }
                }

                // Evidence
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("证据链")
                            .font(.headline)
                        Spacer()
                        Text("\(evidence.count) 条")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    if evidence.isEmpty {
                        Text("暂无关联证据。在论文精读或笔记中引用此论断即可自动关联。")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.vertical, 4)
                    } else {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(evidence) { link in
                                EvidenceRow(link: link, sourceTitle: sourceTitles[link.id], onDelete: {
                                    deleteEvidence(link)
                                })
                            }
                        }
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("论断详情")
        .onAppear {
            loadEvidence()
            startEdit()
        }
    }

    private func startEdit() {
        editTitle = claim.title
        editStatement = claim.statement
        editStatus = KnowledgeClaimStatus.from(claim.status) ?? .hypothesis
        isEditing = false
    }

    private func save() {
        var updated = claim
        updated.title = editTitle
        updated.statement = editStatement
        updated.status = editStatus.rawValue
        try? repo.updateClaim(updated)
        isEditing = false
        onUpdate()
    }

    private func loadEvidence() {
        evidence = (try? repo.listEvidenceLinks(claimId: claim.id)) ?? []
        var titles: [String: String] = [:]
        for link in evidence {
            if let title = try? repo.evidenceSourceTitle(kind: link.sourceKind, id: link.sourceId) {
                titles[link.id] = title
            }
        }
        sourceTitles = titles
    }

    private func deleteEvidence(_ link: EvidenceLink) {
        try? repo.deleteEvidence(id: link.id)
        loadEvidence()
    }

    private func statusColor(_ status: KnowledgeClaimStatus) -> Color {
        switch status {
        case .supported: return .green
        case .contested: return .red
        case .hypothesis: return .orange
        case .open: return .blue
        }
    }
}

private struct EvidenceRow: View {
    let link: EvidenceLink
    let sourceTitle: String?
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: relationIcon)
                .foregroundStyle(relationColor)
                .font(.caption)
            VStack(alignment: .leading, spacing: 2) {
                Text(sourceTitle ?? link.sourceId)
                    .font(.caption.bold())
                    .lineLimit(2)
                Text(sourceKindLabel)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if let summary = link.evidenceSummary {
                    Text(summary)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    private var sourceKindLabel: String {
        switch link.sourceKind {
        case "paper": return "论文"
        case "note": return "笔记"
        case "experiment": return "实验"
        default: return link.sourceKind
        }
    }

    private var relationIcon: String {
        switch link.relationKind {
        case "supports": return "checkmark.circle"
        case "contradicts": return "xmark.circle"
        default: return "link"
        }
    }

    private var relationColor: Color {
        switch link.relationKind {
        case "supports": return .green
        case "contradicts": return .red
        default: return .blue
        }
    }
}

// MARK: - Create Sheet
//
// CreateClaimSheet 已抽到独立文件 CreateClaimSheet.swift（与画布编辑模式共用）。
