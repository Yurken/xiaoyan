//! Agent 共享工作区 —— Worker 间数据流通道。
//!
//! 替代原有 `context_parts: Vec<String>` 的扁平拼接模式，
//! 让下游 Worker 能读取上游 Worker 的结构化输出。

use serde::Serialize;
use std::collections::HashMap;

/// Agent 工作区 —— Worker 间共享中间结果的通道
#[derive(Debug, Clone, Default)]
pub struct SharedWorkspace {
    /// 按 agent_name 索引的结构化输出
    pub outputs: HashMap<String, AgentOutput>,
    /// 累积的上下文片段（兼容现有逻辑）
    pub context_parts: Vec<String>,
}

impl SharedWorkspace {
    /// 为指定 Worker 构建输入上下文：
    /// 基础 context + 上游 Worker 的结构化摘要。
    pub fn build_worker_context(
        &self,
        upstream_deps: &[String],
        agent_title_fn: impl Fn(&str) -> &str,
    ) -> Vec<String> {
        let mut ctx = self.context_parts.clone();
        for dep_name in upstream_deps {
            if let Some(output) = self.outputs.get(dep_name) {
                ctx.push(format!(
                    "[来自{}的分析结果]\n{}",
                    agent_title_fn(dep_name),
                    output.summary
                ));
            }
        }
        ctx
    }
}

/// 单个 Agent 的完整输出（写入 workspace，可被下游读取）
#[derive(Debug, Clone, Serialize)]
pub struct AgentOutput {
    pub agent_name: String,
    /// 简要摘要（给下游 Worker 读取，控制 token 用量）
    pub summary: String,
    /// 完整输出文本
    pub full_content: String,
    /// 结构化元数据（行动项、论文列表等）
    pub metadata: OutputMetadata,
    /// ISO 8601 时间戳
    pub created_at: String,
    /// 执行耗时（毫秒）
    pub duration_ms: u64,
}

/// 按 Agent 角色区分的结构化输出元数据
#[derive(Debug, Clone, Default, Serialize)]
pub struct OutputMetadata {
    /// Planner → 行动项列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action_items: Option<Vec<ActionItem>>,
    /// LiteratureScout → 推荐论文列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommended_papers: Option<Vec<PaperReference>>,
    /// PaperAnalyst → 方法/结论/局限
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analysis_highlights: Option<AnalysisHighlights>,
    /// Survey → 分类标签
    #[serde(skip_serializing_if = "Option::is_none")]
    pub taxonomy: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionItem {
    pub priority: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PaperReference {
    pub title: String,
    pub authors: String,
    pub year: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AnalysisHighlights {
    pub research_question: String,
    pub methods: String,
    pub conclusions: String,
    pub limitations: String,
}

// ─── 依赖图声明 ────────────────────────────────────────────

/// Worker 间数据流依赖声明。
/// key = agent_name, value = 该 Worker 需要读取的上游 Worker 名称列表。
/// 只包含 Worker 间依赖，Retrieval 作为所有 Worker 的前驱在图引擎中单独处理。
pub fn worker_dependencies() -> HashMap<&'static str, Vec<&'static str>> {
    let mut deps = HashMap::new();
    deps.insert("planner", vec![]);
    deps.insert("literature_scout", vec!["planner"]);
    deps.insert("survey", vec!["planner", "literature_scout"]);
    deps.insert("paper_analyst", vec![]);
    deps.insert("reproduction", vec!["paper_analyst"]);
    deps
}

/// 按拓扑排序计算执行波次。
/// 每个波次内的 Worker 互不依赖，可以安全并行执行。
/// 只处理 `selected` 中存在的 Worker（不含 retrieval / synthesis）。
pub fn compute_execution_waves(selected: &[String]) -> Vec<Vec<String>> {
    let deps = worker_dependencies();
    let active_workers: Vec<String> = selected
        .iter()
        .filter(|name| {
            name.as_str() != "retrieval"
                && name.as_str() != "synthesis"
                && deps.contains_key(name.as_str())
        })
        .cloned()
        .collect();

    let mut waves: Vec<Vec<String>> = Vec::new();
    let mut completed: Vec<String> = Vec::new();
    let mut pending = active_workers.clone();

    while !pending.is_empty() {
        let wave: Vec<String> = pending
            .iter()
            .filter(|name| {
                deps.get(name.as_str())
                    .unwrap_or(&vec![])
                    .iter()
                    .all(|dep| {
                        // 依赖已完成，或者不在当前 active 集中（视为外部满足）
                        completed.contains(&dep.to_string())
                            || !active_workers.contains(&dep.to_string())
                    })
            })
            .cloned()
            .collect();

        if wave.is_empty() {
            // 剩余节点存在无法满足的依赖 — 兜底全部执行
            waves.push(pending);
            break;
        }

        for name in &wave {
            pending.retain(|n| n != name);
            completed.push(name.clone());
        }
        waves.push(wave);
    }

    waves
}

// ─── 结构化输出解析 ────────────────────────────────────────

/// 从 Worker 原始输出中提取结构化元数据。
/// 解析失败时返回 Default，不影响主流程。
pub fn parse_agent_metadata(agent_name: &str, content: &str) -> OutputMetadata {
    match agent_name {
        "planner" => OutputMetadata {
            action_items: Some(extract_action_items(content)),
            ..Default::default()
        },
        "literature_scout" => OutputMetadata {
            recommended_papers: Some(extract_paper_references(content)),
            ..Default::default()
        },
        "paper_analyst" => OutputMetadata {
            analysis_highlights: Some(extract_analysis_highlights(content)),
            ..Default::default()
        },
        _ => OutputMetadata::default(),
    }
}

/// 从 Worker 完整输出中提取简要摘要（用于写入 workspace 供下游读取）。
/// 截取前 1500 字符或第一个 `---` 分隔符之前的内容。
pub fn extract_summary(content: &str) -> String {
    let trimmed = content.trim();
    if let Some(sep_pos) = trimmed.find("\n---\n") {
        if sep_pos > 50 && sep_pos <= 1500 {
            return trimmed[..sep_pos].to_string();
        }
    }
    if trimmed.len() > 1500 {
        format!("{}…", &trimmed[..1500])
    } else {
        trimmed.to_string()
    }
}

/// 提取编号行动项（如 "1. 描述 [优先级]"）
fn extract_action_items(content: &str) -> Vec<ActionItem> {
    let mut items = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(pos) = trimmed.find(". ") {
            let num_part = &trimmed[..pos];
            if num_part.chars().all(|c| c.is_ascii_digit()) && num_part.len() <= 2 {
                let rest = &trimmed[pos + 2..];
                let priority = extract_priority(rest);
                let description = strip_priority_marker(rest);
                items.push(ActionItem {
                    priority,
                    description,
                });
            }
        }
    }
    items
}

fn extract_priority(text: &str) -> String {
    let high = ["高", "high", "重要", "关键", "优先"];
    let low = ["低", "low", "可选", "nice-to-have"];
    let lower = text.to_lowercase();
    if high.iter().any(|k| lower.contains(k)) {
        "高".to_string()
    } else if low.iter().any(|k| lower.contains(k)) {
        "低".to_string()
    } else {
        "中".to_string()
    }
}

fn strip_priority_marker(text: &str) -> String {
    let mut result = text.to_string();
    for pattern in &[
        r"\[高\]", r"\[中\]", r"\[低\]",
        r"\[high\]", r"\[medium\]", r"\[low\]",
        r"（高优先级）", r"（中优先级）", r"（低优先级）",
        r"【高】", r"【中】", r"【低】",
    ] {
        if let Ok(re) = regex::Regex::new(pattern) {
            result = re.replace_all(&result, "").to_string();
        }
    }
    result.trim().to_string()
}

/// 从 Literature Scout 输出中提取论文引用。
/// 匹配常见格式：
///   - **Title** (Year) — Authors
///   - "Title" by Authors, Year
///   - 编号列表中的标题行
fn extract_paper_references(content: &str) -> Vec<PaperReference> {
    let mut papers = Vec::new();
    let mut current_title = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // 检测编号列表项（新的论文条目）
        let is_numbered = trimmed
            .split_once(". ")
            .map_or(false, |(n, _)| n.chars().all(|c| c.is_ascii_digit()) && n.len() <= 2);
        let is_bulleted =
            trimmed.starts_with("- ") || trimmed.starts_with("* ") || trimmed.starts_with("• ");

        if is_numbered || is_bulleted {
            // 保存上一条
            if !current_title.is_empty() {
                papers.push(PaperReference {
                    title: current_title.clone(),
                    authors: String::new(),
                    year: String::new(),
                });
            }
            // 提取标题：去掉编号/bullet 和 markdown 加粗
            let text = if is_numbered {
                trimmed.split_once(". ").map(|(_, t)| t).unwrap_or(trimmed)
            } else {
                &trimmed[2..]
            };
            current_title = text
                .trim_start_matches("**")
                .trim_end_matches("**")
                .trim_start_matches('*')
                .trim_end_matches('*')
                .trim()
                .to_string();

            // 尝试从同一行提取年份
            let year_re =
                regex::Regex::new(r"\b(19|20)\d{2}\b").ok();
            if let Some(re) = &year_re {
                if let Some(m) = re.find(&current_title) {
                    // 不删除，保留标题完整性
                    let _ = m.as_str();
                }
            }
        } else if !current_title.is_empty() {
            // 后续行：尝试提取年份和作者
            if papers.last().map_or(true, |_| true) {
                let year_re = regex::Regex::new(r"\b(19|20)\d{2}\b").ok();
                if let Some(re) = &year_re {
                    if let Some(m) = re.find(trimmed) {
                        if let Some(last) = papers.last_mut() {
                            if last.year.is_empty() {
                                last.year = m.as_str().to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    // 保存最后一条
    if !current_title.is_empty() {
        papers.push(PaperReference {
            title: current_title,
            authors: String::new(),
            year: String::new(),
        });
    }

    papers
}

/// 从 Paper Analyst 输出中提取分析要点。
/// 按常见中文/英文 section 标题分割。
fn extract_analysis_highlights(content: &str) -> AnalysisHighlights {
    let find_section = |headers: &[&str]| -> String {
        for &header in headers {
            if let Some(pos) = content.find(header) {
                let after = &content[pos + header.len()..];
                let end = after
                    .find("\n## ")
                    .or_else(|| after.find("\n### "))
                    .or_else(|| after.find("\n**"))
                    .unwrap_or(after.len())
                    .min(400);
                let text = after[..end].trim();
                if !text.is_empty() {
                    return text.to_string();
                }
            }
        }
        String::new()
    };

    AnalysisHighlights {
        research_question: find_section(&[
            "研究问题", "核心问题", "Research Question", "Problem Statement",
        ]),
        methods: find_section(&[
            "方法", "Method", "Approach", "方法概述", "技术路线",
        ]),
        conclusions: find_section(&[
            "结论", "Conclusion", "核心发现", "主要结论", "Key Findings",
        ]),
        limitations: find_section(&[
            "局限", "Limitation", "不足", "局限与展望", "Future Work",
        ]),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wave_computation_basic() {
        let selected: Vec<String> = vec![
            "retrieval", "planner", "literature_scout",
            "survey", "paper_analyst", "reproduction", "synthesis",
        ]
        .into_iter()
        .map(String::from)
        .collect();

        let waves = compute_execution_waves(&selected);

        // Wave 1: planner + paper_analyst (no upstream deps)
        assert!(waves[0].contains(&"planner".to_string()));
        assert!(waves[0].contains(&"paper_analyst".to_string()));

        // Wave 2: literature_scout (depends on planner) + reproduction (depends on paper_analyst)
        assert!(waves[1].contains(&"literature_scout".to_string()));
        assert!(waves[1].contains(&"reproduction".to_string()));

        // Wave 3: survey (depends on planner + literature_scout)
        assert!(waves[2].contains(&"survey".to_string()));
    }

    #[test]
    fn wave_computation_partial() {
        let selected: Vec<String> = vec!["retrieval", "planner", "survey", "synthesis"]
            .into_iter()
            .map(String::from)
            .collect();

        let waves = compute_execution_waves(&selected);

        // planner has no deps → wave 1
        assert_eq!(waves[0], vec!["planner".to_string()]);
        // survey depends on planner + literature_scout, but lit_scout not active → wave 2
        assert_eq!(waves[1], vec!["survey".to_string()]);
    }

    #[test]
    fn extract_summary_short_content() {
        let content = "这是一段短文本";
        assert_eq!(extract_summary(content), "这是一段短文本");
    }

    #[test]
    fn extract_action_items_from_numbered_list() {
        let content = "1. 梳理 Transformer 核心论文 [高]\n2. 对比训练策略 [中]\n3. 调研 MoE 进展 [低]";
        let items = extract_action_items(content);
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].priority, "高");
        assert_eq!(items[2].priority, "低");
    }
}
