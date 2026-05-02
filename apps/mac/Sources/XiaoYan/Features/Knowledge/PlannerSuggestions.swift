import Foundation

struct PlannerDraft: Equatable {
    var topic: String = ""
    var keywords: [String] = []
    var goal: String = ""
    var background: String = ""
    var timeBudget: String = ""
    var constraints: [String] = []
    var knownContext: String = ""
    var preferredOutput: String = ""
}

enum DraftField: String {
    case topic, keywords, goal, background, timeBudget = "time_budget", constraints, knownContext = "known_context", preferredOutput = "preferred_output"
}

struct PlannerSuggestionState {
    var matchedDomains: [String] = []
    var nextField: DraftField = .topic
    var nextFieldLabel: String = "研究主题"
    var summary: String = ""
    var keywordSuggestions: [String] = []
    var goalSuggestions: [String] = []
    var backgroundPrompts: [String] = []
    var timeBudgetSuggestions: [String] = []
    var constraintSuggestions: [String] = []
    var knownContextSuggestions: [String] = []
    var outputSuggestions: [String] = []
}

private struct DomainSuggestionProfile {
    let id: String
    let label: String
    let triggers: [String]
    let keywords: [String]
    let goals: [String]
    let backgroundPrompts: [String]
    let timeBudgets: [String]
    let constraints: [String]
    let knownContext: [String]
    let outputs: [String]
}

private let DOMAIN_PROFILES: [DomainSuggestionProfile] = [
    DomainSuggestionProfile(
        id: "llm",
        label: "大模型 / LLM",
        triggers: ["大模型", "llm", "language model", "transformer", "gpt", "llama", "qwen", "deepseek", "对齐", "rag", "agent"],
        keywords: ["LLM", "Deep Learning", "Transformer", "Instruction Tuning", "Alignment", "RAG", "Reasoning", "Evaluation"],
        goals: [
            "系统梳理大模型技术栈，并确定一个适合复现的小切口",
            "聚焦对齐、推理或检索增强中的一个子方向形成研究问题",
            "先完成领域综述，再收敛到可执行的实验路线",
        ],
        backgroundPrompts: [
            "已学过深度学习、NLP、Transformer 和 PyTorch",
            "更熟悉模型训练、推理系统或评测与数据构建",
        ],
        timeBudgets: ["4-6 周：快速入门与论文扫描", "8-12 周：完成综述与复现", "3-6 个月：形成实验路线"],
        constraints: ["单卡 24G 显存以内", "中文资料优先", "开源模型优先", "可复现优先"],
        knownContext: ["Transformer", "GPT 系列", "Llama", "Qwen", "DeepSeek-R1", "InstructGPT"],
        outputs: ["学习路线", "论文清单", "综述提纲", "复现实验路线", "开题提纲"]
    ),
    DomainSuggestionProfile(
        id: "multimodal",
        label: "多模态 / VLM",
        triggers: ["多模态", "vlm", "vision language", "图文", "视频理解", "语音视觉", "医学影像", "文图"],
        keywords: ["Vision-Language Model", "Contrastive Learning", "Instruction Tuning", "Cross-modal Alignment", "OCR", "Video Understanding"],
        goals: [
            "梳理多模态模型的发展脉络，并聚焦一个任务场景",
            "比较主流 VLM 架构差异，找出可复现且有扩展空间的方向",
        ],
        backgroundPrompts: [
            "做过图像分类、视觉表征学习或多模态数据处理",
            "更关注模型架构、数据对齐或应用场景验证",
        ],
        timeBudgets: ["6-8 周：任务入门与论文梳理", "10-12 周：复现主流 baseline", "4-6 个月：扩展实验"],
        constraints: ["需要公开数据集", "优先轻量模型", "单机训练", "应用场景明确"],
        knownContext: ["CLIP", "LLaVA", "BLIP-2", "Qwen-VL", "Flamingo"],
        outputs: ["任务地图", "模型对比表", "实验路线", "场景调研报告"]
    ),
    DomainSuggestionProfile(
        id: "graph_bio",
        label: "图学习 / 生物医药",
        triggers: ["图神经", "gnn", "graph", "drug", "分子", "蛋白", "bio", "药物发现", "生信", "bioinformatics"],
        keywords: ["GNN", "Molecular Property Prediction", "Graph Contrastive Learning", "Protein Language Model", "Drug Discovery"],
        goals: [
            "从分子/蛋白建模切入，确定一个可公开数据集验证的问题",
            "梳理图学习与生物任务结合的范式，并锁定可复现 baseline",
        ],
        backgroundPrompts: [
            "熟悉图神经网络基础、分子表示和常见药物发现数据集",
            "更想做性质预测、交互预测或生成设计",
        ],
        timeBudgets: ["6-8 周：补足图学习与生物背景", "8-12 周：复现公开 benchmark", "3-6 个月：设计扩展实验"],
        constraints: ["公开 benchmark 优先", "不依赖湿实验", "单人可完成", "评价指标明确"],
        knownContext: ["GCN", "GAT", "GraphMVP", "MoleculeNet", "AlphaFold", "ESM"],
        outputs: ["学习路线", "任务-数据集清单", "实验设计草案", "选题建议"]
    ),
    DomainSuggestionProfile(
        id: "timeseries",
        label: "时序预测",
        triggers: ["时序", "forecast", "预测", "traffic", "energy", "金融", "传感器", "anomaly", "异常检测"],
        keywords: ["Time Series Forecasting", "Foundation Model", "Transformer", "State Space Model", "Anomaly Detection"],
        goals: [
            "从一个具体预测任务切入，比较主流时序模型的优劣",
            "聚焦泛化、长序列建模或异常检测，形成实验问题",
        ],
        backgroundPrompts: [
            "熟悉统计预测方法、深度学习和常见时序 benchmark",
            "更偏基础模型研究、业务场景理解或系统部署",
        ],
        timeBudgets: ["4-6 周：任务和 benchmark 入门", "8-10 周：复现与对比实验", "3-4 个月：深入一个问题"],
        constraints: ["公开数据优先", "指标可复现", "长序列场景优先", "低算力可跑"],
        knownContext: ["Informer", "PatchTST", "TimesFM", "Mamba", "ETT", "M4"],
        outputs: ["综述提纲", "benchmark 对比", "实验路线", "应用选题建议"]
    ),
]

let FIELD_LABELS: [DraftField: String] = [
    .topic: "研究主题",
    .keywords: "关键词",
    .goal: "研究目标",
    .background: "当前基础",
    .timeBudget: "时间预算",
    .constraints: "约束条件",
    .knownContext: "已知论文/方法",
    .preferredOutput: "期望输出",
]

private let BACKGROUND_HINT_POSITIVE_TOKENS = [
    "基础", "学过", "熟悉", "了解", "做过", "经验", "掌握", "背景", "读过", "看过",
    "复现过", "训练过", "实现过", "会用", "用过", "数学", "编程", "pytorch", "transformer", "benchmark",
]

private let BACKGROUND_HINT_NEGATIVE_TOKENS = [
    "twitter", "weibo", "douban", "评价指标", "实验设计", "实验设置", "应用场景",
    "任务定义", "真实数据", "真实场景", "使用什么", "选择什么", "哪些基线", "哪种基线",
]

private func normalize(_ value: String) -> String {
    value.trimmingCharacters(in: .whitespaces).lowercased()
}

private func includesToken(_ haystack: String, _ token: String) -> Bool {
    haystack.lowercased().contains(token.lowercased())
}

private func unique(_ values: [String]) -> [String] {
    var seen = Set<String>()
    return values.filter { value in
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return false }
        let key = normalize(trimmed)
        if seen.contains(key) { return false }
        seen.insert(key)
        return true
    }
}

private func sanitizeBackgroundPrompts(_ values: [String]) -> [String] {
    unique(values).filter { value in
        if value.contains("?") || value.contains("？") { return false }
        let text = normalize(value)
        let hasPositive = BACKGROUND_HINT_POSITIVE_TOKENS.contains { includesToken(text, $0) }
        if !hasPositive { return false }
        let hasNegative = BACKGROUND_HINT_NEGATIVE_TOKENS.contains { includesToken(text, $0) }
        return !hasNegative
    }
}

private func detectProfiles(_ draft: PlannerDraft) -> [DomainSuggestionProfile] {
    let topicText = normalize(draft.topic)
    let fullText = normalize([draft.topic, draft.keywords.joined(separator: " "), draft.goal, draft.background, draft.knownContext].joined(separator: " "))

    let scored: [(profile: DomainSuggestionProfile, score: Int)] = DOMAIN_PROFILES.map { profile in
        let score = profile.triggers.reduce(0) { sum, trigger in
            var next = sum
            if includesToken(topicText, trigger) { next += 3 }
            else if includesToken(fullText, trigger) { next += 1 }
            return next
        }
        return (profile, score)
    }.filter { $0.score > 0 }.sorted { $0.score > $1.score }

    return scored.prefix(2).map { $0.profile }
}

private func inferNextField(_ draft: PlannerDraft) -> DraftField {
    if draft.topic.trimmingCharacters(in: .whitespaces).isEmpty { return .topic }
    if draft.keywords.isEmpty { return .keywords }
    if draft.goal.trimmingCharacters(in: .whitespaces).isEmpty { return .goal }
    if draft.background.trimmingCharacters(in: .whitespaces).isEmpty { return .background }
    if draft.timeBudget.trimmingCharacters(in: .whitespaces).isEmpty { return .timeBudget }
    if draft.constraints.isEmpty { return .constraints }
    if draft.knownContext.trimmingCharacters(in: .whitespaces).isEmpty { return .knownContext }
    if draft.preferredOutput.trimmingCharacters(in: .whitespaces).isEmpty { return .preferredOutput }
    return .preferredOutput
}

private func summarize(_ draft: PlannerDraft, _ domainLabels: [String], _ nextField: DraftField) -> String {
    if draft.topic.trimmingCharacters(in: .whitespaces).isEmpty {
        return "先输入研究主题，小妍才能识别方向并推荐关键词。"
    }
    if domainLabels.isEmpty {
        return "已识别到一个待细化的研究方向，下一步建议补充\(FIELD_LABELS[nextField] ?? "")。"
    }
    return "当前更接近 \(domainLabels.joined(separator: " / ")) 方向，继续补充\(FIELD_LABELS[nextField] ?? "")后，推荐会更聚焦。"
}

func buildPlannerSuggestions(_ draft: PlannerDraft) -> PlannerSuggestionState {
    let profiles = detectProfiles(draft)
    let matchedDomains = profiles.map { $0.label }
    let nextField = inferNextField(draft)
    let goalText = normalize(draft.goal)

    let keywordSuggestions = unique(profiles.flatMap { $0.keywords })
        .filter { item in !draft.keywords.contains(where: { normalize($0) == normalize(item) }) }

    let goalSuggestions = unique(profiles.flatMap { $0.goals })

    let backgroundPrompts = sanitizeBackgroundPrompts(profiles.flatMap { $0.backgroundPrompts })

    var timeBudgetSuggestions = unique(profiles.flatMap { $0.timeBudgets })
    if includesToken(goalText, "综述") || includesToken(goalText, "survey") || includesToken(goalText, "调研") {
        timeBudgetSuggestions = unique(["3-4 周：快速扫描核心文献", "8-12 周：形成结构化综述"] + timeBudgetSuggestions)
    }
    if includesToken(goalText, "复现") || includesToken(goalText, "实验") || includesToken(goalText, "benchmark") {
        timeBudgetSuggestions = unique(["6-8 周：单篇论文复现", "3-6 个月：扩展实验并比较 baseline"] + timeBudgetSuggestions)
    }
    if includesToken(goalText, "开题") || includesToken(goalText, "选题") || includesToken(goalText, "proposal") {
        timeBudgetSuggestions = unique(["2-4 周：缩小问题范围", "6-8 周：整理开题材料与初步路线"] + timeBudgetSuggestions)
    }

    let constraintSuggestions = unique(profiles.flatMap { $0.constraints })
        .filter { item in !draft.constraints.contains(where: { normalize($0) == normalize(item) }) }

    let knownContextSuggestions = unique(profiles.flatMap { $0.knownContext })

    let outputSuggestions = unique(profiles.flatMap { $0.outputs } + ["学习路线", "论文清单", "实验路线", "开题提纲"])

    return PlannerSuggestionState(
        matchedDomains: matchedDomains,
        nextField: nextField,
        nextFieldLabel: FIELD_LABELS[nextField] ?? "",
        summary: summarize(draft, matchedDomains, nextField),
        keywordSuggestions: keywordSuggestions,
        goalSuggestions: goalSuggestions,
        backgroundPrompts: backgroundPrompts,
        timeBudgetSuggestions: timeBudgetSuggestions,
        constraintSuggestions: constraintSuggestions,
        knownContextSuggestions: knownContextSuggestions,
        outputSuggestions: outputSuggestions
    )
}

func mergePlannerSuggestions(fallback: PlannerSuggestionState, ai: PlannerSuggestionState?) -> PlannerSuggestionState {
    guard let ai = ai else { return fallback }
    let nextField = DraftField(rawValue: ai.nextField.rawValue) ?? fallback.nextField
    let bg = sanitizeBackgroundPrompts(ai.backgroundPrompts)
    return PlannerSuggestionState(
        matchedDomains: unique(ai.matchedDomains + fallback.matchedDomains),
        nextField: nextField,
        nextFieldLabel: FIELD_LABELS[nextField] ?? fallback.nextFieldLabel,
        summary: ai.summary.isEmpty ? fallback.summary : ai.summary,
        keywordSuggestions: ai.keywordSuggestions.isEmpty ? fallback.keywordSuggestions : ai.keywordSuggestions,
        goalSuggestions: ai.goalSuggestions.isEmpty ? fallback.goalSuggestions : ai.goalSuggestions,
        backgroundPrompts: bg.isEmpty ? fallback.backgroundPrompts : bg,
        timeBudgetSuggestions: ai.timeBudgetSuggestions.isEmpty ? fallback.timeBudgetSuggestions : ai.timeBudgetSuggestions,
        constraintSuggestions: ai.constraintSuggestions.isEmpty ? fallback.constraintSuggestions : ai.constraintSuggestions,
        knownContextSuggestions: ai.knownContextSuggestions.isEmpty ? fallback.knownContextSuggestions : ai.knownContextSuggestions,
        outputSuggestions: ai.outputSuggestions.isEmpty ? fallback.outputSuggestions : ai.outputSuggestions
    )
}
