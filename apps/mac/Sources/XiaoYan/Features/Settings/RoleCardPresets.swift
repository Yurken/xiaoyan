import Foundation

/// 角色任务卡副字段（如溯源卡的 rag_top_k）。
struct SecondaryField: Hashable {
    let key: String
    let label: String
    let placeholder: String
}

/// 角色任务卡静态预设。
/// 与 desktop `apps/desktop/src/features/settings/shared.tsx:402-645` 中
/// `CHARACTERISTIC_MODEL_CARDS` 1:1 对齐。
struct RoleCardPreset: Identifiable, Hashable {
    let id: String
    let label: String
    let description: String
    let recommendation: String
    /// 多 key 联动写入：填值时所有 modelKeys 同步覆盖；trim 后非空集合 size==1 时显示共同值，否则显示空。
    let modelKeys: [String]
    let temperatureKeys: [String]
    let baseUrlKeys: [String]
    let apiKeyKeys: [String]
    /// 仅溯源卡有副字段（rag_top_k）。
    let secondary: SecondaryField?
}

let ROLE_CARD_PRESETS: [RoleCardPreset] = [
    .init(
        id: "liuguang",
        label: "流光 · 快速响应",
        description: "反应极快，负责方向提示和小妍日常轻量对话。",
        recommendation: "推荐：8B / 14B 级小模型。",
        modelKeys: ["planner_hint_model", "copilot_simple_model"],
        temperatureKeys: ["planner_hint_temperature", "copilot_simple_temperature"],
        baseUrlKeys: ["planner_hint_base_url", "copilot_simple_base_url"],
        apiKeyKeys: ["planner_hint_api_key", "copilot_simple_api_key"],
        secondary: nil
    ),
    .init(
        id: "mouce",
        label: "谋策 · 规划",
        description: "负责深度调度与研究思路分析。",
        recommendation: "推荐：32B+ 推理增强模型。",
        modelKeys: [
            "multi_agent_supervisor_model",
            "planner_analysis_model",
            "planner_generation_model",
            "multi_agent_planner_model",
        ],
        temperatureKeys: [
            "multi_agent_supervisor_temperature",
            "planner_analysis_temperature",
            "planner_generation_temperature",
            "multi_agent_planner_temperature",
        ],
        baseUrlKeys: [
            "multi_agent_supervisor_base_url",
            "planner_analysis_base_url",
            "planner_generation_base_url",
            "multi_agent_planner_base_url",
        ],
        apiKeyKeys: [
            "multi_agent_supervisor_api_key",
            "planner_analysis_api_key",
            "planner_generation_api_key",
            "multi_agent_planner_api_key",
        ],
        secondary: nil
    ),
    .init(
        id: "xiaoyan",
        label: "小妍 · 默认回退",
        description: "各专项任务的统一执行回退。",
        recommendation: "推荐：稳定 32B 模型。",
        modelKeys: ["multi_agent_worker_model"],
        temperatureKeys: ["multi_agent_worker_temperature"],
        baseUrlKeys: ["multi_agent_worker_base_url"],
        apiKeyKeys: ["multi_agent_worker_api_key"],
        secondary: nil
    ),
    .init(
        id: "suyuan",
        label: "溯源 · 向量化与检索",
        description: "知识库向量化、语义检索与 RAG 证据回溯。",
        recommendation: "推荐：text-embedding-3-small 或同等。",
        modelKeys: ["embedding_model"],
        temperatureKeys: [],
        baseUrlKeys: ["embedding_base_url"],
        apiKeyKeys: ["embedding_api_key"],
        secondary: SecondaryField(
            key: "rag_top_k",
            label: "统一检索数量",
            placeholder: "5"
        )
    ),
    .init(
        id: "tanzhi",
        label: "探知 · 搜索",
        description: "全网搜索与信息收集。",
        recommendation: "推荐：联网增强模型或具备搜索能力的模型。",
        modelKeys: ["multi_agent_literature_scout_model", "survey_planner_model"],
        temperatureKeys: [
            "multi_agent_literature_scout_temperature",
            "survey_planner_temperature",
        ],
        baseUrlKeys: ["multi_agent_literature_scout_base_url", "survey_planner_base_url"],
        apiKeyKeys: ["multi_agent_literature_scout_api_key", "survey_planner_api_key"],
        secondary: nil
    ),
    .init(
        id: "dongjian",
        label: "洞见 · 深度总结",
        description: "单篇大文献精读、长上下文。",
        recommendation: "推荐：长上下文 + 推理增强模型。",
        modelKeys: ["paper_analysis_model", "multi_agent_paper_analyst_model"],
        temperatureKeys: ["paper_analysis_temperature", "multi_agent_paper_analyst_temperature"],
        baseUrlKeys: ["paper_analysis_base_url", "multi_agent_paper_analyst_base_url"],
        apiKeyKeys: ["paper_analysis_api_key", "multi_agent_paper_analyst_api_key"],
        secondary: nil
    ),
    .init(
        id: "hanzhang",
        label: "翰章 · 内容生成",
        description: "综述长篇输出与最终整合。",
        recommendation: "推荐：长输出 + 风格稳定模型。",
        modelKeys: ["survey_writer_model", "multi_agent_survey_model", "multi_agent_synthesis_model"],
        temperatureKeys: [
            "survey_writer_temperature",
            "multi_agent_survey_temperature",
            "multi_agent_synthesis_temperature",
        ],
        baseUrlKeys: [
            "survey_writer_base_url",
            "multi_agent_survey_base_url",
            "multi_agent_synthesis_base_url",
        ],
        apiKeyKeys: [
            "survey_writer_api_key",
            "multi_agent_survey_api_key",
            "multi_agent_synthesis_api_key",
        ],
        secondary: nil
    ),
    .init(
        id: "gouyu",
        label: "构域 · 代码",
        description: "论文复现与代码分析。",
        recommendation: "推荐：低温度 + 代码强化模型。",
        modelKeys: ["paper_reproduction_model", "multi_agent_reproduction_model"],
        temperatureKeys: ["paper_reproduction_temperature", "multi_agent_reproduction_temperature"],
        baseUrlKeys: ["paper_reproduction_base_url", "multi_agent_reproduction_base_url"],
        apiKeyKeys: ["paper_reproduction_api_key", "multi_agent_reproduction_api_key"],
        secondary: nil
    ),
    .init(
        id: "shijie",
        label: "视界 · 视觉",
        description: "扫描 PDF 图表/公式截图（多模态）。",
        recommendation: "推荐：具备视觉能力的多模态模型。",
        modelKeys: ["vision_model"],
        temperatureKeys: ["vision_temperature"],
        baseUrlKeys: ["vision_base_url"],
        apiKeyKeys: ["vision_api_key"],
        secondary: nil
    ),
    .init(
        id: "yiheng",
        label: "译衡 · 翻译 (Beta)",
        description: "中英学术互译。",
        recommendation: "推荐：低温度 + 翻译能力强模型。",
        modelKeys: ["translation_model"],
        temperatureKeys: ["translation_temperature"],
        baseUrlKeys: ["translation_base_url"],
        apiKeyKeys: ["translation_api_key"],
        secondary: nil
    ),
]
