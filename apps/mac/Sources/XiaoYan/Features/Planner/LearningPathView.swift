import SwiftUI

struct LearningPathView: View {
    let path: LearningPath?
    @State private var expandedStage: Int? = 0

    var body: some View {
        if let path = path {
            VStack(alignment: .leading, spacing: 16) {
                overviewSection(path)
                prerequisitesSection(path)
                stagesSection(path)
                classicPapersSection(path)
                researchDirectionsSection(path)
                toolsSection(path)
            }
        } else {
            emptyState
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "map")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("暂无规划路线")
                .font(.subheadline.bold())
            Text("路线生成后会在这里展示学习阶段、经典论文和研究方向。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(40)
    }

    // MARK: - Sections

    @ViewBuilder
    private func overviewSection(_ result: LearningPath) -> some View {
        if let overview = result.overview {
            resultCard(title: "领域概述", icon: "book") {
                Text(overview)
                    .font(.body)
                    .textSelection(.enabled)
            }
        }
    }

    @ViewBuilder
    private func prerequisitesSection(_ result: LearningPath) -> some View {
        if let prerequisites = result.prerequisites, !prerequisites.isEmpty {
            resultCard(title: "先修知识", icon: "graduationcap") {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(prerequisites.enumerated()), id: \.offset) { _, pre in
                        prerequisiteRow(pre)
                    }
                }
            }
        }
    }

    private func prerequisiteRow(_ pre: LearningPrerequisite) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(pre.name ?? "")
                .font(.subheadline.bold())
            if let desc = pre.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let resources = pre.resources, !resources.isEmpty {
                HStack(spacing: 6) {
                    ForEach(resources.prefix(4), id: \.self) { r in
                        Text(r)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func stagesSection(_ result: LearningPath) -> some View {
        let stages = result.learningStages ?? result.stages?.enumerated().map { idx, s in
            LearningStageDetail(stage: idx + 1, title: s.title, duration: s.duration, goals: nil, topics: nil, resources: s.resources)
        }
        if let stages = stages, !stages.isEmpty {
            resultCard(title: "学习路径", icon: "list.number") {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(stages.enumerated()), id: \.offset) { idx, stage in
                        stageRow(stage: stage, idx: idx, total: stages.count)
                    }
                }
            }
        }
    }

    private func stageRow(stage: LearningStageDetail, idx: Int, total: Int) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { expandedStage = expandedStage == idx ? nil : idx }) {
                HStack(spacing: 12) {
                    Text("\(stage.stage ?? (idx + 1))")
                        .font(.caption.bold())
                        .frame(width: 24, height: 24)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stage.title ?? "阶段 \(idx + 1)")
                            .font(.subheadline.bold())
                        if let duration = stage.duration {
                            Text(duration)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Image(systemName: expandedStage == idx ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .padding(.vertical, 10)

            if expandedStage == idx {
                stageDetail(stage)
                    .padding(.bottom, 10)
            }

            if idx < total - 1 {
                Divider()
            }
        }
        .padding(.horizontal, 12)
    }

    private func stageDetail(_ stage: LearningStageDetail) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if let goals = stage.goals, !goals.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("学习目标")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(goals, id: \.self) { g in
                        HStack(alignment: .top, spacing: 4) {
                            Text("•")
                                .foregroundStyle(.blue)
                            Text(g)
                                .font(.caption)
                        }
                    }
                }
            }
            if let topics = stage.topics, !topics.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("涵盖主题")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    FlowLayout(spacing: 6) {
                        ForEach(topics, id: \.self) { t in
                            Text(t)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                }
            }
            if let resources = stage.resources, !resources.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("推荐资源")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    ForEach(resources, id: \.self) { r in
                        HStack(alignment: .top, spacing: 4) {
                            Image(systemName: "book")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(r)
                                .font(.caption)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func classicPapersSection(_ result: LearningPath) -> some View {
        if let papers = result.classicPapers, !papers.isEmpty {
            resultCard(title: "经典必读论文", icon: "doc.text") {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(papers.enumerated()), id: \.offset) { idx, paper in
                        classicPaperRow(paper: paper, idx: idx)
                    }
                }
            }
        }
    }

    private func classicPaperRow(paper: ClassicPaper, idx: Int) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text(String(format: "%02d", idx + 1))
                .font(.title3.bold())
                .foregroundStyle(.secondary.opacity(0.3))
            VStack(alignment: .leading, spacing: 2) {
                Text(paper.title ?? "")
                    .font(.subheadline.bold())
                if let authors = paper.authors, let year = paper.year {
                    Text("\(authors) · \(year)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let reason = paper.reason {
                    Text(reason)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(8)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func researchDirectionsSection(_ result: LearningPath) -> some View {
        if let directions = result.researchDirections, !directions.isEmpty {
            resultCard(title: "进一步探索方向", icon: "target") {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(Array(directions.enumerated()), id: \.offset) { _, dir in
                        directionCard(dir)
                    }
                }
            }
        }
    }

    private func directionCard(_ dir: ResearchDirection) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Image(systemName: "target")
                    .font(.caption2)
                    .foregroundStyle(.blue)
                Text(dir.direction ?? "")
                    .font(.subheadline.bold())
            }
            if let desc = dir.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let problems = dir.openProblems, !problems.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(problems.prefix(3), id: \.self) { p in
                        HStack(alignment: .top, spacing: 4) {
                            Text("→")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                            Text(p)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding(10)
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    @ViewBuilder
    private func toolsSection(_ result: LearningPath) -> some View {
        if let tools = result.toolsAndFrameworks, !tools.isEmpty {
            resultCard(title: "常用工具 & 框架", icon: "wrench") {
                FlowLayout(spacing: 8) {
                    ForEach(tools, id: \.self) { t in
                        Text(t)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(Color.secondary.opacity(0.1))
                            .cornerRadius(12)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func resultCard(title: String, icon: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .foregroundStyle(.blue)
                Text(title)
                    .font(.headline)
            }
            content()
        }
        .padding()
        .background(Theme.Colors.surface)
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }
}
