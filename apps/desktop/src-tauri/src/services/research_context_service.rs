use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Serialize, Deserialize)]
pub struct ResearchTheme {
    pub id: String,
    pub name: String,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: String,
    #[serde(rename = "completedTasks")]
    pub completed_tasks: Vec<String>,
    #[serde(rename = "openQuestions")]
    pub open_questions: Vec<String>,
    #[serde(rename = "nextSteps")]
    pub next_steps: Vec<NextStep>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NextStep {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResearchActivityEvent {
    pub id: String,
    #[serde(rename = "themeId")]
    pub theme_id: String,
    #[serde(rename = "eventType")]
    pub event_type: String,
    pub title: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResearchThemeContext {
    pub theme: ResearchTheme,
    pub events: Vec<ResearchActivityEvent>,
}

pub struct ResearchContextService;

impl ResearchContextService {
    pub async fn get_recent_themes(
        db: &sqlx::SqlitePool,
        limit: usize,
    ) -> Result<Vec<ResearchTheme>, String> {
        let rows = sqlx::query(
            "SELECT ri.id, ri.topic, ri.folder_name,
                    COALESCE(ri.updated_at, ri.created_at) as last_active,
                    (SELECT COUNT(*) FROM papers p WHERE p.research_interest_id = ri.id) as paper_count,
                    (SELECT COUNT(*) FROM knowledge_notes n WHERE n.research_interest_id = ri.id) as note_count
             FROM research_interests ri
             ORDER BY last_active DESC
             LIMIT ?"
        )
        .bind(limit as i64)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        let mut themes = Vec::new();
        for row in rows {
            let id: String = row.get("id");
            let topic: String = row.get("topic");
            let folder_name: Option<String> = row.get("folder_name");
            let last_active: String = row.get("last_active");
            let paper_count: i64 = row.get("paper_count");
            let note_count: i64 = row.get("note_count");

            let completed_tasks = vec![
                if paper_count > 0 { format!("已导入 {} 篇论文", paper_count) } else { String::new() },
                if note_count > 0 { format!("已记录 {} 条笔记", note_count) } else { String::new() },
            ]
            .into_iter()
            .filter(|s| !s.is_empty())
            .collect();

            let name = folder_name.unwrap_or(topic);
            themes.push(ResearchTheme {
                id,
                name,
                last_active_at: last_active,
                completed_tasks,
                open_questions: vec![],
                next_steps: vec![],
            });
        }

        Ok(themes)
    }

    pub async fn get_theme_context(
        db: &sqlx::SqlitePool,
        theme_id: &str,
    ) -> Result<ResearchThemeContext, String> {
        let row = sqlx::query(
            "SELECT id, topic, folder_name,
                    COALESCE(updated_at, created_at) as last_active
             FROM research_interests WHERE id = ?"
        )
        .bind(theme_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

        let theme = match row {
            Some(r) => {
                let id: String = r.get("id");
                let topic: String = r.get("topic");
                let folder_name: Option<String> = r.get("folder_name");
                let last_active: String = r.get("last_active");

                let paper_count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM papers WHERE research_interest_id = ?"
                )
                .bind(&id)
                .fetch_one(db)
                .await
                .unwrap_or(0);

                let note_count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*) FROM knowledge_notes WHERE research_interest_id = ?"
                )
                .bind(&id)
                .fetch_one(db)
                .await
                .unwrap_or(0);

                let completed_tasks = [
                    if paper_count > 0 { Some(format!("已导入 {} 篇论文", paper_count)) } else { None },
                    if note_count > 0 { Some(format!("已记录 {} 条笔记", note_count)) } else { None },
                ]
                .into_iter()
                .flatten()
                .collect();

                ResearchTheme {
                    id,
                    name: folder_name.unwrap_or(topic),
                    last_active_at: last_active,
                    completed_tasks,
                    open_questions: vec![],
                    next_steps: vec![],
                }
            }
            None => ResearchTheme {
                id: theme_id.to_string(),
                name: "未知主题".to_string(),
                last_active_at: String::new(),
                completed_tasks: vec![],
                open_questions: vec![],
                next_steps: vec![],
            },
        };

        // Recent activity events for this theme
        let events = Self::recent_theme_events(db, theme_id).await?;

        Ok(ResearchThemeContext { theme, events })
    }

    async fn recent_theme_events(
        db: &sqlx::SqlitePool,
        theme_id: &str,
    ) -> Result<Vec<ResearchActivityEvent>, String> {
        let mut events = Vec::new();

        // Recent papers imported for this theme
        let paper_rows = sqlx::query(
            "SELECT id, title, created_at FROM papers
             WHERE research_interest_id = ?
             ORDER BY created_at DESC LIMIT 5"
        )
        .bind(theme_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for row in paper_rows {
            let id: String = row.get("id");
            let title: String = row.get("title");
            let created_at: String = row.get("created_at");
            events.push(ResearchActivityEvent {
                id,
                theme_id: theme_id.to_string(),
                event_type: "paper_read".into(),
                title,
                timestamp: created_at,
            });
        }

        // Recent notes for this theme
        let note_rows = sqlx::query(
            "SELECT id, title, created_at FROM knowledge_notes
             WHERE research_interest_id = ?
             ORDER BY created_at DESC LIMIT 5"
        )
        .bind(theme_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for row in note_rows {
            let id: String = row.get("id");
            let title: String = row.get("title");
            let created_at: String = row.get("created_at");
            events.push(ResearchActivityEvent {
                id,
                theme_id: theme_id.to_string(),
                event_type: "note_added".into(),
                title,
                timestamp: created_at,
            });
        }

        events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(events)
    }
}

pub async fn build_research_context_summary(
    db: &sqlx::SqlitePool,
    interest_id: &str,
) -> String {
    let ctx = ResearchContextService::get_theme_context(db, interest_id)
        .await
        .unwrap_or_else(|_| ResearchThemeContext {
            theme: ResearchTheme {
                id: interest_id.to_string(),
                name: "未知主题".to_string(),
                last_active_at: String::new(),
                completed_tasks: vec![],
                open_questions: vec![],
                next_steps: vec![],
            },
            events: vec![],
        });

    format!(
        "研究主题：{}\n已完成：{}\n待解决：{}",
        ctx.theme.name,
        ctx.theme.completed_tasks.join("、"),
        ctx.theme.open_questions.join("、"),
    )
}
