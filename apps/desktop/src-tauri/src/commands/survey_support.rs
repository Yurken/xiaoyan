use crate::assistant_prompts::specialist_system;
use crate::links::{doi_url, paper_search_url};
use serde_json::Value;
use std::collections::HashSet;

pub const SURVEY_PLANNER_TPL: &str = r#"请针对研究问题「{query}」输出检索规划。时间范围：{time_range}。文献类型：{lit_types}。检索数据库偏好：{databases}。输出语言偏好：{language}。仅返回合法 JSON：
{
    "scope": "一句话定义本次综述范围",
    "search_queries": ["用于检索的短语，3-6条"],
    "must_cover": ["必须覆盖的核心子主题"],
    "expected_methods": ["候选方法类别"],
    "discipline_scope": "学科范围描述"
}"#;

pub const SURVEY_TIMELINE_TPL: &str = r#"请根据以下候选文献，梳理「{query}」领域的发展脉络。仅返回合法 JSON：
{
    "timeline": [
        {
            "period": "时间段（如 2015-2018）",
            "milestone": "这一阶段的标志性进展（1-2句）",
            "key_works": ["该阶段代表性论文标题"],
            "significance": "为何重要、对后续研究的影响"
        }
    ],
    "earliest_period": "领域起源期简介（1句）",
    "current_frontier": "当前前沿方向概括（1句）"
}

研究问题：{query}

候选文献（按年份排序）：
{papers_by_year}"#;

pub const SURVEY_WRITER_TPL: &str = r#"请基于研究问题、文献及发展脉络，输出全面、可信、信息密度足够的结构化文献综述。仅返回合法 JSON。所有代表性工作、趋势和判断都必须优先来自候选文献或补充语义证据；证据不足时请明确写成研究缺口，不要杜撰论文、作者或结论。
写作密度要求：
1. `background` 不要只写一句话，应完整说明研究对象、重要性与应用背景。
2. `topic_landscape` 需要 2-3 段，串联研究主线、方法分化、阶段性共识与仍未解决的问题，总长度尽量达到 220-400 字。
3. 当候选文献不少于 8 篇时，`major_methods`、`research_trends`、`challenges`、`research_gaps`、`future_directions` 原则上各给出 3 项以上。
4. `overall_summary` 需要 5-8 句，明确当前判断、主要空白以及后续值得继续追踪的方向。
5. 如果某部分证据不足，请直接写“证据不足/尚无共识”，不要用重复论文标题凑数。
输出语言要求：{language}。
{
    "background": "研究背景（4-6句，含领域定义、重要性与应用价值）",
    "topic_landscape": "围绕研究主线、方法分化、阶段性共识与分歧的综合分析，2-3段",
    "major_methods": [
        {
            "name": "方法类别",
            "description": "方法核心思想",
            "representative_papers": ["代表论文标题"],
            "pros": "主要优势",
            "cons": "主要局限"
        }
    ],
    "schools_of_thought": [
        {
            "name": "学派/流派名称",
            "description": "核心主张与视角",
            "representatives": ["代表学者或代表性工作"]
        }
    ],
    "methodology_summary": {
        "mainstream": "当前主流方法简述",
        "emerging": "新兴方法简述",
        "comparison": "方法优劣对比小结"
    },
    "research_trends": [
        {
            "trend": "趋势名称",
            "signal": "为何出现该趋势、证据"
        }
    ],
    "controversies": [
        {
            "topic": "学界争议点",
            "positions": ["各方观点简述"]
        }
    ],
    "challenges": ["当前关键挑战"],
    "research_gaps": ["现有研究缺口，每条对应一个可切入的空白点"],
    "future_directions": ["未来研究方向与预测"],
    "recommended_topics": [
        {
            "topic": "适合新手切入的研究主题",
            "why": "推荐原因",
            "first_step": "第一步行动建议"
        }
    ],
    "overall_summary": "总结与方向建议（5-8句）"
}

研究问题：{query}
任务范围：{scope}
候选文献数量：{paper_count}
时间范围：{time_range}
文献类型：{lit_types}
输出语言：{language}
必须覆盖：{must_cover}
候选方法：{expected_methods}

发展脉络：
{timeline}

候选文献：
{papers}

补充语义证据：
{evidence}"#;

pub fn survey_planner_system() -> String {
    specialist_system(
        "研究任务规划 Agent",
        "把用户研究问题拆解成可检索的子问题，并充分利用用户给定的约束条件。",
        Some("输出必须聚焦、可检索、可执行。"),
    )
}

pub fn survey_timeline_system() -> String {
    specialist_system(
        "文献时序分析 Agent",
        "梳理学术领域的发展脉络、关键阶段和演进逻辑。",
        Some("输出必须基于候选文献，不得编造。"),
    )
}

pub fn survey_writer_system() -> String {
    specialist_system(
        "文献综述写作 Agent",
        "生成结构化、全面、可信且可执行的学术文献综述。",
        Some("输出必须基于输入材料，不得夸大或编造。"),
    )
}

fn truncate_for_prompt(text: &str, max_chars: usize) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= max_chars {
        return normalized;
    }
    let mut truncated = normalized.chars().take(max_chars).collect::<String>();
    truncated.push_str("...");
    truncated
}

pub fn build_papers_text(papers: &[Value]) -> String {
    if papers.is_empty() {
        return "无匹配论文。".to_string();
    }
    papers
        .iter()
        .enumerate()
        .map(|(idx, paper)| {
            format!(
                "[{}] {} | {} | {} | {}\n摘要: {}",
                idx + 1,
                paper.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                paper.get("authors").and_then(|v| v.as_str()).unwrap_or(""),
                paper
                    .get("year")
                    .and_then(|v| v.as_i64())
                    .map(|year| year.to_string())
                    .unwrap_or_default(),
                paper.get("venue").and_then(|v| v.as_str()).unwrap_or(""),
                truncate_for_prompt(
                    paper.get("abstract").and_then(|v| v.as_str()).unwrap_or(""),
                    900,
                )
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub fn build_papers_by_year_text(papers: &[Value]) -> String {
    if papers.is_empty() {
        return "无匹配论文。".to_string();
    }
    let mut sorted = papers.to_vec();
    sorted.sort_by_key(|paper| paper.get("year").and_then(|v| v.as_i64()).unwrap_or(0));
    sorted
        .iter()
        .map(|paper| {
            format!(
                "[{}] {} ({})",
                paper
                    .get("year")
                    .and_then(|v| v.as_i64())
                    .map(|year| year.to_string())
                    .unwrap_or_else(|| "年份未知".to_string()),
                paper.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                paper.get("venue").and_then(|v| v.as_str()).unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn build_timeline_text(timeline_json: &Value) -> String {
    let mut out = String::new();
    if let Some(earliest_period) = timeline_json
        .get("earliest_period")
        .and_then(|v| v.as_str())
    {
        out.push_str(&format!("起源：{}\n\n", earliest_period));
    }
    if let Some(stages) = timeline_json.get("timeline").and_then(|v| v.as_array()) {
        for stage in stages {
            let period = stage.get("period").and_then(|v| v.as_str()).unwrap_or("");
            let milestone = stage
                .get("milestone")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            out.push_str(&format!("• {}：{}\n", period, milestone));
        }
    }
    if let Some(frontier) = timeline_json
        .get("current_frontier")
        .and_then(|v| v.as_str())
    {
        out.push_str(&format!("\n当前前沿：{}", frontier));
    }
    out
}

pub fn build_formatted_citations(papers: &[Value], format: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let deduped = papers
        .iter()
        .filter_map(|paper| {
            let citation = format_citation(paper, format).trim().to_string();
            if citation.is_empty() || !seen.insert(citation.clone()) {
                return None;
            }
            Some(citation)
        })
        .collect::<Vec<_>>();

    deduped
        .into_iter()
        .enumerate()
        .map(|(idx, citation)| format!("[{}] {}", idx + 1, citation))
        .collect()
}

fn format_citation(paper: &Value, format: &str) -> String {
    let title = paper
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Title");
    let authors = paper.get("authors").and_then(|v| v.as_str()).unwrap_or("");
    let year = paper
        .get("year")
        .and_then(|v| v.as_i64())
        .map(|year| year.to_string())
        .unwrap_or_default();
    let venue = paper.get("venue").and_then(|v| v.as_str()).unwrap_or("");
    let doi = paper
        .get("doi")
        .and_then(|v| v.as_str())
        .filter(|value| !value.is_empty());
    let is_journal = paper.get("ccf_type").and_then(|v| v.as_str()) == Some("journal");

    match format {
        "apa" => {
            let mut citation = String::new();
            if !authors.is_empty() {
                citation.push_str(authors);
                citation.push_str(". ");
            }
            if !year.is_empty() {
                citation.push_str(&format!("({}). ", year));
            }
            citation.push_str(title);
            citation.push('.');
            if !venue.is_empty() {
                citation.push_str(&format!(" {}", venue));
            }
            if let Some(value) = doi {
                citation.push_str(&format!(". https://doi.org/{}", value));
            }
            citation
        }
        "mla" => {
            let mut citation = String::new();
            if !authors.is_empty() {
                citation.push_str(authors);
                citation.push_str(". ");
            }
            citation.push_str(&format!("\"{}\"", title));
            if !venue.is_empty() {
                citation.push_str(&format!(", {}", venue));
            }
            if !year.is_empty() {
                citation.push_str(&format!(", {}", year));
            }
            citation.push('.');
            if let Some(value) = doi {
                citation.push_str(&format!(" doi:{}", value));
            }
            citation
        }
        "ieee" => {
            let mut citation = String::new();
            if !authors.is_empty() {
                citation.push_str(authors);
                citation.push_str(", ");
            }
            citation.push_str(&format!("\"{}\"", title));
            if !venue.is_empty() {
                citation.push_str(&format!(", {}", venue));
            }
            if !year.is_empty() {
                citation.push_str(&format!(", {}", year));
            }
            citation.push('.');
            if let Some(value) = doi {
                citation.push_str(&format!(" doi: {}", value));
            }
            citation
        }
        _ => {
            let lit_mark = if is_journal { "J" } else { "C" };
            let mut citation = String::new();
            if !authors.is_empty() {
                citation.push_str(authors);
                citation.push_str(". ");
            }
            citation.push_str(&format!("{}[{}]", title, lit_mark));
            if !venue.is_empty() {
                citation.push_str(&format!(". {}", venue));
            }
            if !year.is_empty() {
                citation.push_str(&format!(", {}", year));
            }
            if let Some(value) = doi {
                citation.push_str(&format!(". DOI:{}", value));
            } else {
                citation.push('.');
            }
            citation
        }
    }
}

fn push_paragraph_section(out: &mut String, title: &str, content: Option<&str>) {
    let Some(content) = content.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    out.push_str(&format!("## {}\n\n{}\n\n", title, content));
}

pub fn build_survey_markdown(
    query: &str,
    report: &Value,
    papers: &[Value],
    formatted_citations: &[String],
    cite_format: &str,
) -> String {
    let mut out = String::new();
    out.push_str(&format!("# 文献综述\n\n**研究问题**：{}\n\n", query));

    push_paragraph_section(
        &mut out,
        "研究背景",
        report.get("background").and_then(|v| v.as_str()),
    );
    push_paragraph_section(
        &mut out,
        "领域现状综述",
        report.get("topic_landscape").and_then(|v| v.as_str()),
    );

    if let Some(stages) = report
        .get("development_timeline")
        .and_then(|v| v.as_array())
    {
        if !stages.is_empty() {
            out.push_str("## 发展脉络\n\n");
            if let Some(earliest_period) = report.get("earliest_period").and_then(|v| v.as_str()) {
                out.push_str(&format!("> {}\n\n", earliest_period));
            }
            for stage in stages {
                let period = stage.get("period").and_then(|v| v.as_str()).unwrap_or("");
                let milestone = stage
                    .get("milestone")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                out.push_str(&format!("**{}**：{}\n", period, milestone));
                if let Some(works) = stage.get("key_works").and_then(|v| v.as_array()) {
                    let works_str = works
                        .iter()
                        .filter_map(|work| work.as_str())
                        .map(|title| {
                            paper_search_url(Some(title))
                                .map(|url| format!("[{}]({})", title, url))
                                .unwrap_or_else(|| title.to_string())
                        })
                        .collect::<Vec<_>>()
                        .join("；");
                    if !works_str.is_empty() {
                        out.push_str(&format!("  - 代表工作：{}\n", works_str));
                    }
                }
                if let Some(significance) = stage.get("significance").and_then(|v| v.as_str()) {
                    out.push_str(&format!("  - 意义：{}\n", significance));
                }
                out.push('\n');
            }
            if let Some(frontier) = report.get("current_frontier").and_then(|v| v.as_str()) {
                out.push_str(&format!("**当前前沿**：{}\n\n", frontier));
            }
        }
    }

    if let Some(methods) = report.get("major_methods").and_then(|v| v.as_array()) {
        if !methods.is_empty() {
            out.push_str("## 主要方法\n\n");
            for (idx, method) in methods.iter().enumerate() {
                out.push_str(&format!(
                    "### {}. {}\n",
                    idx + 1,
                    method
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("未命名")
                ));
                if let Some(description) = method.get("description").and_then(|v| v.as_str()) {
                    out.push_str(&format!("- 核心思想：{}\n", description));
                }
                if let Some(pros) = method.get("pros").and_then(|v| v.as_str()) {
                    out.push_str(&format!("- 优势：{}\n", pros));
                }
                if let Some(cons) = method.get("cons").and_then(|v| v.as_str()) {
                    out.push_str(&format!("- 局限：{}\n", cons));
                }
                if let Some(representative_papers) = method
                    .get("representative_papers")
                    .and_then(|v| v.as_array())
                {
                    let rep_titles = representative_papers
                        .iter()
                        .filter_map(|value| value.as_str())
                        .map(|title| {
                            paper_search_url(Some(title))
                                .map(|url| format!("[{}]({})", title, url))
                                .unwrap_or_else(|| title.to_string())
                        })
                        .collect::<Vec<_>>()
                        .join("；");
                    if !rep_titles.is_empty() {
                        out.push_str(&format!("- 代表论文：{}\n", rep_titles));
                    }
                }
                out.push('\n');
            }
        }
    }

    if let Some(schools) = report.get("schools_of_thought").and_then(|v| v.as_array()) {
        if !schools.is_empty() {
            out.push_str("## 主要学派与流派\n\n");
            for school in schools {
                let name = school
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("未命名");
                out.push_str(&format!("**{}**", name));
                if let Some(description) = school.get("description").and_then(|v| v.as_str()) {
                    out.push_str(&format!("：{}", description));
                }
                out.push('\n');
                if let Some(representatives) =
                    school.get("representatives").and_then(|v| v.as_array())
                {
                    let rep_str = representatives
                        .iter()
                        .filter_map(|value| value.as_str())
                        .collect::<Vec<_>>()
                        .join("、");
                    if !rep_str.is_empty() {
                        out.push_str(&format!("  - 代表：{}\n", rep_str));
                    }
                }
            }
            out.push('\n');
        }
    }

    if let Some(summary) = report.get("methodology_summary") {
        if summary
            .get("mainstream")
            .or(summary.get("emerging"))
            .or(summary.get("comparison"))
            .is_some()
        {
            out.push_str("## 研究方法总结\n\n");
            if let Some(value) = summary.get("mainstream").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **主流方法**：{}\n", value));
            }
            if let Some(value) = summary.get("emerging").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **新兴方法**：{}\n", value));
            }
            if let Some(value) = summary.get("comparison").and_then(|v| v.as_str()) {
                out.push_str(&format!("- **方法对比**：{}\n", value));
            }
            out.push('\n');
        }
    }

    if let Some(trends) = report.get("research_trends").and_then(|v| v.as_array()) {
        if !trends.is_empty() {
            out.push_str("## 研究趋势\n\n");
            for trend in trends {
                let name = trend
                    .get("trend")
                    .and_then(|v| v.as_str())
                    .unwrap_or("趋势");
                let signal = trend.get("signal").and_then(|v| v.as_str()).unwrap_or("");
                out.push_str(&format!("- **{}**：{}\n", name, signal));
            }
            out.push('\n');
        }
    }

    if let Some(controversies) = report.get("controversies").and_then(|v| v.as_array()) {
        if !controversies.is_empty() {
            out.push_str("## 研究争议\n\n");
            for controversy in controversies {
                let topic = controversy
                    .get("topic")
                    .and_then(|v| v.as_str())
                    .unwrap_or("争议点");
                out.push_str(&format!("**{}**\n", topic));
                if let Some(positions) = controversy.get("positions").and_then(|v| v.as_array()) {
                    for position in positions {
                        if let Some(value) = position.as_str() {
                            out.push_str(&format!("  - {}\n", value));
                        }
                    }
                }
                out.push('\n');
            }
        }
    }

    if let Some(challenges) = report.get("challenges").and_then(|v| v.as_array()) {
        if !challenges.is_empty() {
            out.push_str("## 当前挑战\n\n");
            for challenge in challenges {
                if let Some(value) = challenge.as_str() {
                    out.push_str(&format!("- {}\n", value));
                }
            }
            out.push('\n');
        }
    }

    if let Some(gaps) = report.get("research_gaps").and_then(|v| v.as_array()) {
        if !gaps.is_empty() {
            out.push_str("## 研究缺口\n\n");
            for (idx, gap) in gaps.iter().enumerate() {
                if let Some(value) = gap.as_str() {
                    out.push_str(&format!("{}. {}\n", idx + 1, value));
                }
            }
            out.push('\n');
        }
    }

    if let Some(future_directions) = report.get("future_directions").and_then(|v| v.as_array()) {
        if !future_directions.is_empty() {
            out.push_str("## 未来研究方向\n\n");
            for direction in future_directions {
                if let Some(value) = direction.as_str() {
                    out.push_str(&format!("- {}\n", value));
                }
            }
            out.push('\n');
        }
    }

    if let Some(recommended_topics) = report.get("recommended_topics").and_then(|v| v.as_array()) {
        if !recommended_topics.is_empty() {
            out.push_str("## 建议研究主题\n\n");
            for (idx, topic) in recommended_topics.iter().enumerate() {
                out.push_str(&format!(
                    "{}. {}\n",
                    idx + 1,
                    topic
                        .get("topic")
                        .and_then(|v| v.as_str())
                        .unwrap_or("未命名主题")
                ));
                if let Some(why) = topic.get("why").and_then(|v| v.as_str()) {
                    out.push_str(&format!("   - 推荐理由：{}\n", why));
                }
                if let Some(first_step) = topic.get("first_step").and_then(|v| v.as_str()) {
                    out.push_str(&format!("   - 第一步：{}\n", first_step));
                }
            }
            out.push('\n');
        }
    }

    push_paragraph_section(
        &mut out,
        "总结",
        report.get("overall_summary").and_then(|v| v.as_str()),
    );

    if !papers.is_empty() {
        out.push_str("## 检索到的候选论文\n\n");
        for (idx, paper) in papers.iter().enumerate() {
            let title = paper
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("未知标题");
            let authors = paper.get("authors").and_then(|v| v.as_str()).unwrap_or("");
            let year = paper
                .get("year")
                .and_then(|v| v.as_i64())
                .map(|value| value.to_string())
                .unwrap_or_default();
            let venue = paper.get("venue").and_then(|v| v.as_str()).unwrap_or("");
            let ccf = paper
                .get("ccf_rating")
                .and_then(|v| v.as_str())
                .map(|value| format!(" [CCF {}]", value))
                .unwrap_or_default();
            let venue_type = paper
                .get("ccf_type")
                .and_then(|v| v.as_str())
                .map(|value| {
                    if value == "journal" {
                        " [期刊]"
                    } else {
                        " [会议]"
                    }
                })
                .unwrap_or("");
            let link = paper
                .get("doi")
                .and_then(|v| v.as_str())
                .filter(|value| !value.is_empty())
                .and_then(|value| doi_url(Some(value)))
                .or_else(|| paper_search_url(Some(title)));
            let linked_title = link
                .map(|url| format!("[{}]({})", title, url))
                .unwrap_or_else(|| title.to_string());
            out.push_str(&format!(
                "{}. {} {} {} {}{}{}\n",
                idx + 1,
                linked_title,
                authors,
                year,
                venue,
                ccf,
                venue_type
            ));
        }
        out.push('\n');
    }

    if !formatted_citations.is_empty() {
        let format_name = match cite_format {
            "apa" => "APA",
            "mla" => "MLA",
            "ieee" => "IEEE",
            _ => "GB/T 7714",
        };
        out.push_str(&format!("## 参考文献（{} 格式）\n\n", format_name));
        for citation in formatted_citations {
            out.push_str(citation);
            out.push_str("\n\n");
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::{build_formatted_citations, build_survey_markdown};
    use serde_json::json;

    #[test]
    fn build_formatted_citations_deduplicates_duplicate_entries() {
        let papers = vec![
            json!({ "title": "Paper A", "authors": "Alice", "year": 2024, "venue": "ICML" }),
            json!({ "title": "Paper A", "authors": "Alice", "year": 2024, "venue": "ICML" }),
        ];

        let citations = build_formatted_citations(&papers, "ieee");

        assert_eq!(citations.len(), 1);
        assert!(citations[0].starts_with("[1]"));
    }

    #[test]
    fn build_survey_markdown_renders_topic_landscape() {
        let report = json!({
            "background": "背景",
            "topic_landscape": "第一段。\n\n第二段。",
            "overall_summary": "总结"
        });

        let markdown = build_survey_markdown("测试问题", &report, &[], &[], "gbt7714");

        assert!(markdown.contains("## 领域现状综述"));
        assert!(markdown.contains("第一段。\n\n第二段。"));
    }
}
