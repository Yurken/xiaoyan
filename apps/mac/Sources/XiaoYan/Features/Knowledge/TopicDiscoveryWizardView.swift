import SwiftUI

/// 4 步研究方向发现向导：领域 → 目标类型 → 背景 → AI 候选课题。
/// 与 desktop `apps/desktop/src/features/knowledge/TopicDiscoveryWizard.tsx:33-202` 1:1 对齐。
struct TopicDiscoveryWizardView: View {
    @EnvironmentObject var settings: AppSettings
    let knowledgeService: KnowledgeService
    /// 用户选中候选课题时回调（一般用于回填到外层表单的 topic 字段）。
    let onSelect: (String) -> Void
    /// 用户点击右上"收起"时回调。
    let onClose: () -> Void

    enum Step {
        case field, goal, background, results
    }

    @State private var step: Step = .field
    @State private var field = ""
    @State private var goalType = ""
    @State private var background = ""
    @State private var loading = false
    @State private var topics: [String] = []
    @State private var error: String?

    private static let fields = [
        "计算机 / 人工智能", "生物医学", "材料与化学", "教育技术",
        "经济与金融", "社会与人文", "电子 / 通信", "其他",
    ]

    private static let goalTypes = [
        "提出新方法 / 算法", "解决工程落地问题", "系统调研与综述",
        "数据分析与挖掘", "理论证明与推导", "跨学科融合创新",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            fieldStep
            if step != .field {
                goalStep
            }
            if step == .background || step == .results {
                backgroundStep
            }
            if step == .results {
                resultsStep
            }
        }
        .padding(12)
        .background(
            LinearGradient(
                colors: [Color(red: 0.95, green: 0.96, blue: 0.98), Theme.Colors.surface],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
        )
        .cornerRadius(Theme.Radii.medium)
        .nmShadow(level: Theme.Shadows.soft)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(.blue)
                    Text("让小妍帮你找方向")
                        .font(.subheadline.bold())
                }
                Text("回答几个问题，小妍推荐适合你的研究课题")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("收起", action: onClose)
                .buttonStyle(.plain)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Step 1 / 2 chip grids

    private var fieldStep: some View {
        chipGroup(
            title: "你的研究领域",
            options: Self.fields,
            selected: field,
            onSelect: { value in
                field = value
                if step == .field {
                    step = .goal
                }
            }
        )
    }

    private var goalStep: some View {
        chipGroup(
            title: "你想做什么类型的研究",
            options: Self.goalTypes,
            selected: goalType,
            onSelect: { value in
                goalType = value
                if step == .goal {
                    step = .background
                }
            }
        )
    }

    private func chipGroup(
        title: String,
        options: [String],
        selected: String,
        onSelect: @escaping (String) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
            FlowLayout(spacing: 6) {
                ForEach(options, id: \.self) { opt in
                    Button {
                        onSelect(opt)
                    } label: {
                        Text(opt)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(selected == opt ? Color.white : .primary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(selected == opt ? Color.accentColor : Theme.Colors.surface)
                            .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Step 3 background

    private var backgroundStep: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text("简单说说你的背景")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Text("（可选）")
                    .font(.caption2)
                    .foregroundStyle(.secondary.opacity(0.7))
            }
            TextField(
                "例如：硕士在读，熟悉 Python，对 NLP 和医疗数据感兴趣…",
                text: $background,
                axis: .vertical
            )
            .textFieldStyle(.roundedBorder)
            .font(.caption)
            .lineLimit(2...3)

            if step == .background {
                HStack {
                    Spacer()
                    Button {
                        Task { await generate() }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "sparkles")
                            Text("让小妍来推荐")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(field.isEmpty || goalType.isEmpty)
                }
            }
        }
    }

    // MARK: - Step 4 results

    private var resultsStep: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("选一个感兴趣的方向")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                Spacer()
                Button("换一批") {
                    Task { await generate() }
                }
                .buttonStyle(.plain)
                .font(.caption2)
                .foregroundStyle(.blue)
                .disabled(loading)
            }

            if loading {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.small)
                    Text("小妍正在思考…")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            } else if let error {
                Text(error)
                    .font(.caption2)
                    .foregroundStyle(.red)
            } else {
                VStack(spacing: 5) {
                    ForEach(topics, id: \.self) { topic in
                        Button {
                            onSelect(topic)
                        } label: {
                            Text(topic)
                                .font(.caption)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                                .background(Theme.Colors.surface)
                                .cornerRadius(8)
                        }
                        .buttonStyle(.plain)
                    }
                    if topics.isEmpty {
                        Text("没有结果，换组关键词试试")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - Generation

    private func generate() async {
        loading = true
        error = nil
        step = .results
        let result = await knowledgeService.suggestTopics(
            field: field,
            goalType: goalType,
            background: background,
            settings: settings
        )
        if let result {
            topics = result
        } else {
            error = "生成失败，请检查 LLM 配置或稍后重试"
        }
        loading = false
    }
}
