use crate::assistant_prompts::specialist_system;
use crate::commands::paper_figures::PaperFigureContext;

const AGENT1_PROMPT: &str = r#"请对以下论文内容进行深度问题背景分析，仅返回严格合法的 JSON，不输出任何其他内容。

论文文本（引言/相关工作/开篇区段）：
{text}

输出要求：
- 先判断论文类型，再选择合适的阅读框架；常见类型包括：实验/系统/方法论文、综述论文、纯理论论文、数据集/资源论文、设计/案例研究、人文社科或跨学科论文。
- paper_type 字段为机器可读的英文枚举，只能取以下之一：experimental（实验/系统/方法论文）、review（综述/系统性综述）、theory（纯理论/数学论文）、dataset（数据集/资源论文）、case_study（设计/案例研究）、humanities（人文社科/跨学科）、other（无法归类）。
- type_label 字段为对应的中文类型名（如“实验/方法论文”“综述论文”“理论论文”“数据集论文”“案例研究”“人文社科论文”），供后续解读阶段统一沿用。
- research_question 字段值使用中文富文本，段落间用 \n\n 分隔，段内换行用 \n。
- 栏目标题必须按论文类型自然调整，不要机械套用固定模板；只省略确实完全不适用的栏目，不要写“暂无”“不适用”凑数。
- 但必须保留该论文类型的全部核心栏目（一般 4-5 个），逐栏给出实质内容，严禁整体惜字如金、大面积留空或只写一两句敷衍。
- 实验/系统/方法论文可分析研究问题、任务定义、现有方法不足、适用边界。
- 综述论文应分析综述范围、组织维度、纳入/排除标准、领域争议与空白，不要把它写成提出新算法的论文。
- 纯理论论文应分析核心命题、前提假设、理论空白、定义/定理要解决的困难。
- 人文社科论文应分析研究问题、理论视角、材料/样本/语境、论证对象与解释边界，不要强行套“技术方法/实验”。
- 每个保留栏目至少 3-5 句实质性分析，必须结合论文实际内容展开具体细节，严禁空泛、套话或复制摘要。
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式。
- 图表引用必须按需：研究问题部分不要主动要求返回图片或占位符；只有原文明确围绕某个图表展开、且引用对理解背景必要时，才可自然引用编号。
- 严禁为了让前端展示图片而编造 Figure/Table 编号、写图片占位符或 Markdown 图片语法。

返回格式（严格 JSON，不得有多余字符）：
{"paper_type": "experimental", "type_label": "实验/方法论文", "research_question": "**论文类型与阅读方式**\n\n（先判断这篇文章应该按哪种论文来读，并说明为什么）\n\n**核心问题/论题**\n\n（用适合该论文类型的语言说明它真正要处理的问题、论题或知识空白）\n\n**问题重要性与语境**\n\n（说明这个问题为什么值得研究；综述可写领域脉络，理论文可写理论缺口，人文社科可写历史/社会/文本语境）\n\n**已有工作或既有解释的不足**\n\n（结合论文实际内容说明旧方法、旧理论、既有证据或既有综述在哪里不足）\n\n**适用边界与前提**\n\n（列出论文依赖的关键前提、材料边界、理论假设或应用边界）"}"#;

const AGENT2_PROMPT: &str = r#"请对以下论文内容进行深度方法/论证路径分析，仅返回严格合法的 JSON，不输出任何其他内容。

前置分析（研究问题概述，供参考）：
{problem_summary}

论文文本（方法/理论/材料/分析框架核心区段）：
{text}

输出要求：
- core_method 字段值使用中文富文本，公式名称/变量名保持英文。
- 先延续前置分析中的论文类型判断，再选择对应分析方式；不要把综述、理论论文、人文社科论文硬写成算法论文。
- 栏目标题必须按论文类型自然调整，只省略确实完全不适用的栏目；该类型的核心栏目必须保留并写满实质内容。
- 实验/系统/方法论文：解释核心技术思路、关键模块、设计权衡、为什么有效。
- 综述论文：解释分类框架、文献选择逻辑、比较维度、综合/归纳方式、是否形成新的领域地图。
- 纯理论论文：解释定义、命题/定理、证明策略、关键假设、推导链条和理论贡献。
- 人文社科论文：解释理论框架、材料来源、分析单位、方法论立场、证据组织和解释路径。
- 每个保留栏目至少 3-5 句实质性内容，结合论文细节展开，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）；严禁整体过短或只罗列结构而不解释。
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式。
- 图表引用必须按需：只有架构图、流程图、概念框架图、材料编码框架图等能帮助解释方法/论证结构时才引用编号；不要引用实验结果图、对比图、消融曲线或表格。
- 不要输出图片占位符，不要为了让前端显示图片而强行写 Figure/Table 编号。

返回格式：
{"core_method": "**核心框架/论证路径**\n\n（按论文类型说明最关键的技术框架、理论构造、综述框架或分析路径）\n\n**关键设计、概念或材料处理**\n\n（实验论文写模块/算法；综述写分类与选择标准；理论文写定义/定理/证明结构；人文社科写材料、理论视角与解释策略）\n\n**与既有工作的本质区别**\n\n（说明本文不是简单重复旧工作，而是在哪个环节改变了问题、框架、证据或解释方式）\n\n**关键权衡与局限前提**\n\n（说明这种方法/框架/论证方式带来的好处、代价和成立条件）"}"#;

const AGENT3_PROMPT: &str = r#"请对以下论文的证据、验证、实验或论证结果部分进行深度分析，仅返回严格合法的 JSON，不输出任何其他内容。

前置分析（方法/论证路径概述，供参考）：
{method_summary}

论文文本（实验/结果/证明/案例/讨论区段）：
{text}

输出要求：
- 两个字段均使用中文富文本，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）。
- 每个保留子栏目至少 3-5 句实质性内容，结合论文实际证据展开，严禁过短、套话或大面积留空。
- 先判断论文是否真的有实验。没有实验时，不要编造数据集、指标、消融或实验截图。
- experiment_design 字段用于“证据/验证/论证设计”：实验论文写数据、基线、指标、消融；综述写文献纳入和比较维度；理论文写证明路径和关键引理；人文社科写材料、样本、访谈/文本/案例处理与可信度控制。
- experiment_results 字段用于“结果/发现/推导结论”：实验论文写定量/定性结果；综述写归纳出的格局、争议和空白；理论文写定理含义、推论与反例边界；人文社科写主要发现、解释张力与证据支持强度。
- 不适用的子栏目直接省略；不要写“暂无实验所以无法分析”后就停止，应改为分析该论文实际采用的证据或论证方式。
- 要有批判性视角，不只是复述数字、定理或作者结论。
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式。
- 不要为了展示图片而引用图表编号；默认不触发截图、曲线图或结果图展示。
- 严禁输出图片占位符或编造图表编号。

返回格式：
{"experiment_design": "**证据/验证设计**\n\n（按论文类型分析其证据组织、实验设计、证明结构、文献选择或材料处理方式）\n\n**比较对象与可信度控制**\n\n（实验论文写基线公平性；综述写纳入标准与覆盖面；理论文写假设强弱与证明依赖；人文社科写样本/材料边界与解释可靠性）", "experiment_results": "**主要结果/发现**\n\n（按论文类型说明最重要的结果、归纳发现、定理含义或解释结论）\n\n**结果支持了什么，也没有支持什么**\n\n（批判性判断证据是否足以支持作者声称，哪些地方仍然不足、过度外推或有争议）\n\n**边界、反例与例外**\n\n（说明在哪些数据、场景、理论假设、历史语境或文本材料下结论可能不成立）"}"#;

const AGENT4_PROMPT: &str = r#"基于对一篇论文多阶段精读的结果，请从资深同行评审员/领域读者视角做最终综合评价，仅返回严格合法的 JSON，不输出任何其他内容。

研究问题分析：
{problem_summary}

方法/论证路径分析：
{method_summary}

证据/验证/结果分析：
{experiment_summary}

输出要求：
- 三个字段均使用中文富文本，以加粗标题组织，标题单独成段（标题行与内容之间用 \\n\\n 隔开）。
- 每个字段的各保留栏目至少 3-5 句实质性评价，要有具体判断与依据，严禁过短、空泛或大面积留空。
- 先延续论文类型判断，再选择评价维度；不要把所有论文都按“技术新颖性 + 实验充分性 + 复现性”评分。
- innovations 字段写“这篇论文真正贡献了什么”：实验论文可写技术贡献；综述写领域地图/分类框架/问题重组；理论文写概念、定理或证明贡献；人文社科写解释框架、材料发现或理论介入。
- limitations 字段写“读者应警惕什么”：按论文类型指出方法、证据、材料、理论假设、外推范围、综述覆盖面或解释偏差。
- key_conclusions 字段写“读后如何使用它”：不要固定写“最值得记住的结论”；应给出适合的阅读收束、适合读者、后续使用方式或追问方向。
- 综合评分可选且必须按论文类型调整维度；如果评分不适合该论文，可改为“可信度/启发性/覆盖度/清晰度”等定性评估。
- 所有数学公式必须使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$，不得用纯文本写公式。
- 综合评价不要新增图表引用；如需提及图表，只复用前序分析中已经必要引用的编号，严禁为了展示图片而写占位符。

返回格式：
{"innovations": "**真正有价值的贡献**\n\n（按论文类型总结真正贡献：技术、理论、综述框架、材料发现、解释路径或问题重构）\n\n**核心洞察的价值**\n\n（说明这篇文章改变了读者对什么问题的理解，而不是简单复述作者摘要）\n\n**对后续工作的可能影响**\n\n（说明它可能打开哪些研究、教学、工程、理论或解释方向）", "limitations": "**实质性局限**\n\n（从论文类型出发识别局限：方法假设、证明范围、文献覆盖、材料代表性、解释偏差、实验公平性等）\n\n**证据或论证上的薄弱环节**\n\n（说明哪些结论支撑充分，哪些仍需更多证据、证明、案例或比较）\n\n**使用时的边界**\n\n（提醒读者在哪些场景、学科语境、数据条件或理论前提下不能直接套用）", "key_conclusions": "**阅读收束**\n\n（用 1-3 句话说清这篇论文最应带走的认识；标题可按论文类型改写）\n\n**适合哪类读者优先阅读**\n\n（说明不同读者应重点看哪些部分）\n\n**后续可追问的问题**\n\n（给出最自然的 2-4 个延伸问题；综述可写待补空白，理论文可写待放宽假设，人文社科可写待比较材料或语境）\n\n**整体判断（按论文类型调整维度）**\n（给出克制的综合评价，不强制使用实验充分性或复现性评分）"}"#;

const REPRODUCE_PROMPT: &str = r#"请根据以下论文内容生成复现/验证指南，仅返回严格合法的 JSON，不要输出 JSON 以外的内容。

核心原则：
- 先判断这篇论文是否适合“工程复现”。实验/系统/算法论文可以生成完整复现链路；综述、纯理论、人文社科、概念性论文通常不应强行生成代码、训练流程或数据集。
- 所有字段内容使用中文，URL 除外。
- 字段值使用 Markdown 格式：有序列表用 `1. 2. 3.`，子项用缩进，重点用 **加粗**，代码/命令/库名用 `反引号`。
- 内容要完整但克制，优先给最小可执行步骤，不要写成长篇背景综述。
- 不要使用 Markdown 表格。
- 不要输出超过 10 行的长代码块，不要给大段 Python 脚本；如需示例，只给最小命令骨架或 3-6 行伪代码。
- 不要为不适合复现的论文编造 GitHub 仓库、训练命令、数据集、评估指标或实验截图。

适配规则：
- 若论文是实验/系统/算法论文，且有方法、数据、指标或实现细节：填写可执行复现步骤；未开源代码时可给替代实现、相似开源项目和合理推断，并明确标注“（推断）”。
- 若论文是综述论文：不要生成训练流程；可在 risks_and_notes 中给“综述复核路径”，例如复核检索式、纳入标准、分类框架和遗漏文献风险。其他工程字段没有实际内容时返回空字符串。
- 若论文是纯理论论文：不要生成数据准备/训练/推理；可在 risks_and_notes 中给“理论复核路径”，例如定义检查、定理依赖、证明步骤复核、反例搜索和形式化验证可能性。
- 若论文是人文社科或案例研究：不要生成算法复现；可在 risks_and_notes 中给“研究复核路径”，例如材料来源核验、编码一致性、访谈/文本/案例边界、替代解释和伦理限制。
- 如果某字段对该论文不适用，返回空字符串，不要写“暂无”。

字段要求：

code_repository：
- 只在论文提供官方代码、社区复现或明确可参考实现时填写链接。
- 不适合工程复现或没有可信链接时返回空字符串。

environment_setup：
- 只在需要实际运行代码/模型/实验时填写环境配置。
- 非工程复现论文返回空字符串。

dependencies：
- 只列出实际需要安装的软件包、框架或工具。
- 非工程复现论文返回空字符串。

dataset_preparation：
- 实验论文写数据集名称、规模、获取链接、预处理步骤。
- 综述/理论/人文社科论文除非确有公开语料、档案或数据集需要复核，否则返回空字符串。

training_process：
- 只在存在训练或优化过程时填写。
- 非训练型论文返回空字符串。

inference_process：
- 只在存在模型加载、推理或应用过程时填写。
- 非模型推理型论文返回空字符串。

evaluation_metrics：
- 实验论文列出指标、计算方式和论文报告值。
- 理论文可在确有形式化验证指标时填写；综述/人文社科通常返回空字符串。

risks_and_notes：
- 必填。先说明本文适合“工程复现”“理论复核”“综述复核”“材料/案例复核”还是“不适合复现，只适合阅读核查”。
- 对实验论文写复现难点、资源需求、随机性、版本兼容和降级方案。
- 对非实验论文写可执行的复核清单，不要强行制造代码流程。

论文内容：
{text}

返回格式：
{{"code_repository":"...","environment_setup":"...","dependencies":"...","dataset_preparation":"...","training_process":"...","inference_process":"...","evaluation_metrics":"...","risks_and_notes":"..."}}"#;

pub(crate) fn build_agent1_prompt(text: &str) -> String {
    AGENT1_PROMPT.replace("{text}", text)
}

pub(crate) fn build_agent2_prompt(problem_summary: &str, text: &str) -> String {
    AGENT2_PROMPT
        .replace("{problem_summary}", problem_summary)
        .replace("{text}", text)
}

pub(crate) fn build_agent3_prompt(method_summary: &str, text: &str) -> String {
    AGENT3_PROMPT
        .replace("{method_summary}", method_summary)
        .replace("{text}", text)
}

pub(crate) fn build_agent4_prompt(
    problem_summary: &str,
    method_summary: &str,
    experiment_summary: &str,
) -> String {
    AGENT4_PROMPT
        .replace("{problem_summary}", problem_summary)
        .replace("{method_summary}", method_summary)
        .replace("{experiment_summary}", experiment_summary)
}

pub(crate) fn build_reproduce_prompt(text: &str) -> String {
    REPRODUCE_PROMPT.replace("{text}", text)
}

/// 由首轮判定的论文类型生成统一前置指令，注入后续各解读阶段，
/// 避免每个阶段各自重新归类、最终都退化成“方法/实验”论文模板。
pub(crate) fn build_type_directive(type_label: &str) -> String {
    let label = type_label.trim();
    if label.is_empty() {
        return String::new();
    }
    format!(
        "【已判定论文类型】本文已判定为「{label}」，请严格按该类型选择分析维度与栏目，沿用首轮判断不要重新归类；不适用“方法/实验”论文的维度直接省略，严禁为了凑结构而编造方法、实验、数据集或指标。\n\n"
    )
}

pub(crate) fn agent1_system() -> String {
    specialist_system(
        "论文精读 · 问题背景分析专家",
        "先判断论文类型，再解析研究问题、论题、理论空白、综述范围或材料语境。",
        Some("不得编造，不得空泛；栏目必须按论文类型灵活调整。"),
    )
}

pub(crate) fn agent2_system() -> String {
    specialist_system(
        "论文精读 · 方法与论证路径专家",
        "按论文类型解析技术方法、综述框架、理论证明、材料处理或解释路径。",
        Some("必须说清楚为什么这种方法、框架或论证路径成立，而不只是复述结构。"),
    )
}

pub(crate) fn agent3_system() -> String {
    specialist_system(
        "论文精读 · 证据与结果分析专家",
        "按论文类型分析实验、证明、综述归纳、案例材料或解释结果的可信度与边界。",
        Some("要有批判性视角；没有实验时严禁编造实验。"),
    )
}

pub(crate) fn agent4_system() -> String {
    specialist_system(
        "论文精读 · 综合评审专家",
        "基于论文类型综合评价真正贡献、实质局限与读后可用的结论。",
        Some("不要把所有论文都按实验论文打分；综述、理论和人文社科论文要使用相应评价维度。"),
    )
}

pub(crate) fn reproduce_system() -> String {
    specialist_system(
        "论文复现/验证工程师",
        "先判断论文是否适合工程复现，再给出代码复现、理论复核、综述复核或材料复核路径。",
        Some("不适合工程复现时不要编造代码、数据集、训练流程或仓库链接。"),
    )
}

pub(crate) fn build_method_figure_context(figures: &[PaperFigureContext]) -> String {
    let method_figures = figures
        .iter()
        .filter(|figure| is_method_figure_context(figure))
        .take(8)
        .map(|figure| {
            let label = figure.reference_label();
            if let Some(caption) = figure.caption.as_deref() {
                format!("  • {label}: {caption}")
            } else {
                format!("  • {label}")
            }
        })
        .collect::<Vec<_>>();

    if method_figures.is_empty() {
        return String::new();
    }

    format!(
        "【可选方法图上下文（仅供核心方法/论证框架解析按需引用）】\n{}\n请只在解释方法结构、理论框架、流程、分类框架或材料编码结构时引用这些 Figure 编号；不要引用实验结果截图、曲线图或表格，不要为了展示图片而写占位符。\n\n",
        method_figures.join("\n")
    )
}

fn is_method_figure_context(figure: &PaperFigureContext) -> bool {
    if !figure.kind.eq_ignore_ascii_case("figure") {
        return false;
    }

    let Some(caption) = figure.caption.as_deref() else {
        return true;
    };
    let normalized = caption.to_ascii_lowercase();
    const EXCLUDE_KEYWORDS: &[&str] = &[
        "result",
        "performance",
        "experiment",
        "comparison",
        "ablation",
        "quantitative",
        "qualitative",
        "accuracy",
        "benchmark",
        "dataset",
        "baseline",
        "evaluation",
        "visualization",
        "curve",
        "结果",
        "性能",
        "实验",
        "对比",
        "消融",
        "准确",
        "指标",
        "曲线",
        "评估",
        "数据集",
        "基线",
        "可视化",
    ];
    const INCLUDE_KEYWORDS: &[&str] = &[
        "architecture",
        "framework",
        "overview",
        "pipeline",
        "model",
        "module",
        "method",
        "network",
        "algorithm",
        "workflow",
        "system",
        "approach",
        "schema",
        "diagram",
        "structure",
        "encoder",
        "decoder",
        "taxonomy",
        "typology",
        "conceptual",
        "架构",
        "框架",
        "流程",
        "方法",
        "模型",
        "模块",
        "网络",
        "算法",
        "结构",
        "示意",
        "概览",
        "分类",
        "概念",
    ];

    if EXCLUDE_KEYWORDS
        .iter()
        .any(|keyword| normalized.contains(keyword))
    {
        return false;
    }
    if INCLUDE_KEYWORDS
        .iter()
        .any(|keyword| normalized.contains(keyword))
    {
        return true;
    }

    true
}
