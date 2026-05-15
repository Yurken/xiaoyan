use crate::commands::knowledge::ResearchInterestProfilePayload;
use crate::services::memory_checkpoint_service::checkpoint_to_memory_line;
use serde_json::Value;
use sqlx::{Row, SqlitePool};

pub async fn build_research_context_summary(db: &SqlitePool, interest_id: &str) -> String {
    let row = match sqlx::query(
        "SELECT topic, keywords, profile, learning_path FROM research_interests WHERE id = ?",
    )
    .bind(interest_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(row)) => row,
        _ => return String::new(),
    };

    let topic: String = row.get("topic");
    let keywords = parse_string_list(
        &row.get::<Option<String>, _>("keywords")
            .unwrap_or_else(|| "[]".into()),
    );
    let profile = row
        .get::<Option<String>, _>("profile")
        .and_then(|value| serde_json::from_str::<ResearchInterestProfilePayload>(&value).ok())
        .unwrap_or_default();
    let learning_path = row
        .get::<Option<String>, _>("learning_path")
        .and_then(|value| serde_json::from_str::<Value>(&value).ok())
        .unwrap_or_default();

    let mut lines = vec![format!("当前研究方向：{topic}")];
    append_if_present(&mut lines, "关键词", keywords.join("、"));
    append_if_present(&mut lines, "研究目标", profile.goal.unwrap_or_default());
    append_if_present(
        &mut lines,
        "当前基础",
        profile.background.unwrap_or_default(),
    );
    append_if_present(
        &mut lines,
        "时间预算",
        profile.time_budget.unwrap_or_default(),
    );
    append_if_present(
        &mut lines,
        "期望输出",
        profile.preferred_output.unwrap_or_default(),
    );
    append_if_present(
        &mut lines,
        "已知论文/方法",
        profile.known_context.unwrap_or_default(),
    );
    append_if_present(
        &mut lines,
        "约束条件",
        profile.constraints.unwrap_or_default().join("、"),
    );

    let stage_titles = learning_stage_titles(&learning_path);
    if !stage_titles.is_empty() {
        lines.push(format!("当前路线阶段：{}", stage_titles.join(" -> ")));
    }

    append_rows(
        &mut lines,
        "已关联论文",
        load_related_papers(db, interest_id).await,
    );
    append_rows(
        &mut lines,
        "已沉淀笔记",
        load_related_notes(db, interest_id).await,
    );
    append_rows(
        &mut lines,
        "知识图谱主张",
        load_related_claims(db, interest_id).await,
    );

    let checkpoint_lines = load_recent_checkpoints(db, interest_id).await;
    if !checkpoint_lines.is_empty() {
        lines.push(format!("最近 checkpoint：{}", checkpoint_lines.join("；")));
    }

    lines.join("\n")
}

fn append_if_present(lines: &mut Vec<String>, label: &str, value: String) {
    let trimmed = value.trim();
    if !trimmed.is_empty() {
        lines.push(format!("{label}：{trimmed}"));
    }
}

fn append_rows(lines: &mut Vec<String>, label: &str, rows: Vec<String>) {
    if !rows.is_empty() {
        lines.push(format!("{label}：{}", rows.join("；")));
    }
}

fn parse_string_list(raw: &str) -> Vec<String> {
    serde_json::from_str::<Vec<String>>(raw).unwrap_or_default()
}

fn learning_stage_titles(learning_path: &Value) -> Vec<String> {
    learning_path
        .get("learning_stages")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("title").and_then(|value| value.as_str()))
                .take(4)
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

async fn load_related_papers(db: &SqlitePool, interest_id: &str) -> Vec<String> {
    let rows = sqlx::query(
        "SELECT title, status FROM papers WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 5",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.iter()
        .map(|item| {
            let title: String = item.get("title");
            let status: Option<String> = item.get("status");
            format!(
                "{}{}",
                title,
                status
                    .filter(|value| !value.trim().is_empty())
                    .map(|value| format!("（{value}）"))
                    .unwrap_or_default()
            )
        })
        .collect()
}

async fn load_related_notes(db: &SqlitePool, interest_id: &str) -> Vec<String> {
    sqlx::query(
        "SELECT title FROM knowledge_notes WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 5",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .iter()
    .map(|item| item.get::<String, _>("title"))
    .collect()
}

async fn load_related_claims(db: &SqlitePool, interest_id: &str) -> Vec<String> {
    sqlx::query(
        "SELECT title, status FROM knowledge_graph_claims WHERE research_interest_id = ? ORDER BY updated_at DESC LIMIT 5",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .iter()
    .map(|item| {
        let title: String = item.get("title");
        let status: String = item.get("status");
        format!("{title}（{status}）")
    })
    .collect()
}

async fn load_recent_checkpoints(db: &SqlitePool, interest_id: &str) -> Vec<String> {
    sqlx::query(
        "SELECT goal, summary, next_steps, updated_at
         FROM memory_session_summaries
         WHERE context_type = 'interest' AND context_id = ?
         ORDER BY updated_at DESC
         LIMIT 3",
    )
    .bind(interest_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
    .iter()
    .map(|row| {
        checkpoint_to_memory_line(
            &row.get::<String, _>("updated_at"),
            &row.get::<String, _>("goal"),
            &row.get::<String, _>("summary"),
            &row.get::<String, _>("next_steps"),
        )
        .trim()
        .to_string()
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use super::{learning_stage_titles, parse_string_list};
    use serde_json::json;

    #[test]
    fn parses_learning_stage_titles() {
        let value = json!({
            "learning_stages": [
                { "title": "入门" },
                { "title": "复现" },
                { "title": "投稿" }
            ]
        });

        assert_eq!(learning_stage_titles(&value), vec!["入门", "复现", "投稿"]);
    }

    #[test]
    fn invalid_keyword_json_returns_empty_list() {
        assert!(parse_string_list("not json").is_empty());
    }
}
