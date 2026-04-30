import Foundation

struct SkillService {
    static let builtInSkills: [Skill] = [
        Skill(id: "paper-read", name: "paper-read", title: "论文精读", descriptionText: "逐段解读论文", prompt: BuiltInPrompts.paperRead, tags: ["paper"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "paper-critique", name: "paper-critique", title: "论文批判", descriptionText: "批判性分析论文", prompt: BuiltInPrompts.paperCritique, tags: ["paper"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "paper-compare", name: "paper-compare", title: "论文对比", descriptionText: "对比多篇论文", prompt: BuiltInPrompts.paperCompare, tags: ["paper"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "simplify", name: "simplify", title: "简化", descriptionText: "简化复杂概念", prompt: BuiltInPrompts.simplify, tags: ["writing"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "polish", name: "polish", title: "润色", descriptionText: "学术写作润色", prompt: BuiltInPrompts.polish, tags: ["writing"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "abstract-write", name: "abstract-write", title: "摘要撰写", descriptionText: "撰写论文摘要", prompt: BuiltInPrompts.abstractWrite, tags: ["writing"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "related-work", name: "related-work", title: "相关工作", descriptionText: "撰写相关工作章节", prompt: BuiltInPrompts.relatedWork, tags: ["writing"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "survey-outline", name: "survey-outline", title: "综述大纲", descriptionText: "生成综述论文大纲", prompt: BuiltInPrompts.surveyOutline, tags: ["survey"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "peer-review", name: "peer-review", title: "同行评审", descriptionText: "模拟同行评审", prompt: BuiltInPrompts.peerReview, tags: ["review"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "code-explain", name: "code-explain", title: "代码解释", descriptionText: "解释代码逻辑", prompt: BuiltInPrompts.codeExplain, tags: ["code"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "code-review", name: "code-review", title: "代码审查", descriptionText: "审查代码质量", prompt: BuiltInPrompts.codeReview, tags: ["code"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "reproduce-plan", name: "reproduce-plan", title: "复现计划", descriptionText: "制定论文复现计划", prompt: BuiltInPrompts.reproducePlan, tags: ["reproduce"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "research-plan", name: "research-plan", title: "研究计划", descriptionText: "制定研究计划", prompt: BuiltInPrompts.researchPlan, tags: ["planning"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "translate-academic", name: "translate-academic", title: "学术翻译", descriptionText: "中文学术翻译", prompt: BuiltInPrompts.translateAcademic, tags: ["translation"], isBuiltin: true, isEnabled: true, createdAt: nil),
        Skill(id: "checklist", name: "checklist", title: "检查清单", descriptionText: "生成检查清单", prompt: BuiltInPrompts.checklist, tags: ["planning"], isBuiltin: true, isEnabled: true, createdAt: nil),
    ]
}

private enum BuiltInPrompts {
    static let paperRead = "请逐段解读这篇论文，对每个段落：1) 总结核心内容 2) 解释关键技术 3) 指出与前文的关联"
    static let paperCritique = "请从方法论、实验设计、结果分析、写作质量等维度，批判性地分析这篇论文的优缺点。"
    static let paperCompare = "请对比分析这些论文的：1) 研究问题 2) 方法异同 3) 实验结果 4) 创新点与局限"
    static let simplify = "请用通俗易懂的语言重新解释这段内容，避免过多专业术语，适合初学者理解。"
    static let polish = "请润色这段学术写作，改善：1) 用词精准度 2) 句式多样性 3) 逻辑连贯性 4) 学术规范"
    static let abstractWrite = "基于论文内容，撰写一份结构化的摘要，包含：背景、方法、结果、结论。"
    static let relatedWork = "基于给定的参考文献列表，撰写一个逻辑清晰的相关工作章节。"
    static let surveyOutline = "为这个研究方向生成一份综述论文大纲，包含各章节的核心内容建议。"
    static let peerReview = "以审稿人身份评审这篇论文，提供：主要优点、主要缺点、修改建议、推荐意见。"
    static let codeExplain = "逐段解释这段代码的功能、设计思路和关键实现细节。"
    static let codeReview = "审查这段代码的：1) 正确性 2) 效率 3) 可读性 4) 潜在问题 5) 改进建议"
    static let reproducePlan = "为这篇论文制定详细的复现计划：环境配置、数据准备、实现步骤、验证方法。"
    static let researchPlan = "根据你的研究兴趣和目标，制定一份系统的研究计划，包含里程碑和时间线。"
    static let translateAcademic = "将这段内容翻译为地道的中文学术表达，保持专业术语准确。"
    static let checklist = "根据任务类型生成一份检查清单，确保所有关键步骤都被考虑到。"
}
