use crate::assistant_prompts::specialist_system;
use crate::llm::{resolve_model, resolve_temperature_chain, LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use tauri::State;

const CROSS_ANALYSIS_PROMPT: &str = r#"你是一位资深学术审稿人。请对以下多篇论文进行系统的交叉对比分析。

分析要求：
1. **研究问题对比**：各论文解决的核心问题是什么？它们之间有何关联或差异？
2. **方法对比**：各论文使用的方法/模型/框架是什么？各自的创新点和局限性？
3. **实验与数据集**：各论文使用了哪些数据集和评估指标？实验结果是否可以横向对比？
4. **贡献与影响**：各论文的核心贡献是什么？在该研究方向的地位如何？
5. **互补与冲突**：这些论文之间是否存在互补关系或结论冲突？
6. **未来方向**：基于这些论文的共同趋势，值得探索的方向是什么？

请用中文撰写分析报告。对于每篇论文，引用格式为「[序号] 标题」。"#;

#[tauri::command]
pub async fn papers_cross_analysis(
    state: State<'_, AppState>,
    paper_ids: Vec<String>,
) -> Result<serde_json::Value, String> {
    if paper_ids.len() < 2 {
        return Err("请至少选择 2 篇论文进行比较。".into());
    }
    if paper_ids.len() > 8 {
        return Err("最多支持 8 篇论文的交叉分析。".into());
    }

    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let model = resolve_model(&settings, &["copilot_simple_model"]);
    let temperature = resolve_temperature_chain(&settings, &["copilot_simple_temperature"], 0.3);

    let mut paper_texts = Vec::new();
    let mut paper_meta = Vec::new();
    for (i, paper_id) in paper_ids.iter().enumerate() {
        let row = sqlx::query(
            "SELECT title, authors, year, venue, abstract, full_text FROM papers WHERE id = ?",
        )
        .bind(paper_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("未找到论文: {}", paper_id))?;

        let title: String = row.get("title");
        let authors: Option<String> = row.get("authors");
        let year: Option<i32> = row.get("year");
        let venue: Option<String> = row.get("venue");
        let abstract_text: Option<String> = row.get("abstract");
        let full_text: Option<String> = row.get("full_text");

        let content = if let Some(ref ft) = full_text {
            ft.chars().take(3000).collect::<String>()
        } else if let Some(ref ab) = abstract_text {
            ab.chars().take(2000).collect::<String>()
        } else {
            String::new()
        };

        paper_meta.push(json!({
            "index": i + 1,
            "title": title,
            "authors": authors.clone().unwrap_or_default(),
            "year": year,
            "venue": venue.clone().unwrap_or_default(),
        }));

        paper_texts.push(format!(
            "[{}] {}\n作者: {}\n年份: {}\n出处: {}\n内容摘要: {}",
            i + 1,
            title,
            authors.as_deref().unwrap_or("未知"),
            year.map(|y| y.to_string()).unwrap_or_default(),
            venue.as_deref().unwrap_or("未知"),
            content,
        ));
    }

    let paper_block = paper_texts.join("\n\n---\n\n");
    let sys_prompt = format!(
        "{} {}",
        specialist_system("审稿人", "交叉对比分析多篇论文", None),
        CROSS_ANALYSIS_PROMPT
    );

    let messages = vec![
        LlmMessage::system(&sys_prompt),
        LlmMessage::user(format!(
            "请对以下 {} 篇论文进行交叉对比分析：\n\n{paper_block}",
            paper_ids.len()
        )),
    ];

    let response = client
        .chat(&messages, model.as_deref(), temperature)
        .await
        .map_err(|e| e.to_string())?;

    Ok(json!({
        "papers": paper_meta,
        "analysis": response,
    }))
}
