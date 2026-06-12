use crate::services::memory_checkpoint_service::parse_checkpoint_list;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::collections::HashSet;

const MAX_THEME_OPEN_QUESTIONS: usize = 3;
const MAX_THEME_NEXT_STEPS: usize = 3;

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

struct ResearchThemeBase {
    id: String,
    name: String,
    last_active_at: String,
    paper_count: i64,
    note_count: i64,
}

struct ResearchCheckpointSignal {
    goal: String,
    summary: String,
    status: String,
    updated_at: String,
    open_questions: Vec<String>,
    next_steps: Vec<String>,
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
            let base = Self::theme_base_from_row(&row);
            let (theme, _) = Self::hydrate_theme(db, base).await?;
            themes.push(theme);
        }

        Ok(themes)
    }

    pub async fn get_theme_context(
        db: &sqlx::SqlitePool,
        theme_id: &str,
    ) -> Result<ResearchThemeContext, String> {
        let row = sqlx::query(
            "SELECT id, topic, folder_name,
                    COALESCE(updated_at, created_at) as last_active,
                    (SELECT COUNT(*) FROM papers WHERE research_interest_id = research_interests.id) as paper_count,
                    (SELECT COUNT(*) FROM knowledge_notes WHERE research_interest_id = research_interests.id) as note_count
             FROM research_interests WHERE id = ?"
        )
        .bind(theme_id)
        .fetch_optional(db)
        .await
        .map_err(|e| e.to_string())?;

        let (theme, events) = match row {
            Some(r) => {
                let base = Self::theme_base_from_row(&r);
                Self::hydrate_theme(db, base).await?
            }
            None => {
                let theme = Self::build_missing_theme(theme_id);
                (theme, Vec::new())
            }
        };

        Ok(ResearchThemeContext { theme, events })
    }

    fn theme_base_from_row(row: &sqlx::sqlite::SqliteRow) -> ResearchThemeBase {
        let topic: String = row.get("topic");
        let folder_name: Option<String> = row.get("folder_name");

        ResearchThemeBase {
            id: row.get("id"),
            name: folder_name.unwrap_or(topic),
            last_active_at: row.get("last_active"),
            paper_count: row.get("paper_count"),
            note_count: row.get("note_count"),
        }
    }

    async fn hydrate_theme(
        db: &sqlx::SqlitePool,
        base: ResearchThemeBase,
    ) -> Result<(ResearchTheme, Vec<ResearchActivityEvent>), String> {
        let checkpoints = Self::recent_theme_checkpoints(db, &base.id, 5).await?;
        let events = Self::recent_theme_events(db, &base.id).await?;
        let theme = Self::build_theme(base, &checkpoints, &events);
        Ok((theme, events))
    }

    fn build_theme(
        base: ResearchThemeBase,
        checkpoints: &[ResearchCheckpointSignal],
        events: &[ResearchActivityEvent],
    ) -> ResearchTheme {
        let completed_tasks = Self::completed_tasks(&base);
        let open_questions = Self::build_open_questions(&base, checkpoints, events);
        let next_steps = Self::build_next_steps(&base, checkpoints, events);

        ResearchTheme {
            id: base.id,
            name: base.name,
            last_active_at: base.last_active_at,
            completed_tasks,
            open_questions,
            next_steps,
        }
    }

    fn build_missing_theme(theme_id: &str) -> ResearchTheme {
        let name = "未知主题".to_string();
        let base = ResearchThemeBase {
            id: theme_id.to_string(),
            name,
            last_active_at: String::new(),
            paper_count: 0,
            note_count: 0,
        };
        let open_questions = Self::fallback_open_questions(&base);
        let next_steps = Self::fallback_next_steps(&base);

        ResearchTheme {
            id: base.id,
            name: base.name,
            last_active_at: base.last_active_at,
            completed_tasks: Vec::new(),
            open_questions,
            next_steps,
        }
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

    async fn recent_theme_checkpoints(
        db: &sqlx::SqlitePool,
        theme_id: &str,
        limit: i64,
    ) -> Result<Vec<ResearchCheckpointSignal>, String> {
        let rows = sqlx::query(
            "SELECT goal, summary, status, updated_at, open_questions, next_steps
             FROM memory_session_summaries
             WHERE (context_type = 'interest' AND context_id = ?)
                OR id IN (
                    SELECT checkpoint_id FROM memory_links
                    WHERE entity_type = 'research_interest' AND entity_id = ?
                )
             ORDER BY updated_at DESC
             LIMIT ?"
        )
        .bind(theme_id)
        .bind(theme_id)
        .bind(limit.clamp(1, 10))
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        Ok(rows
            .into_iter()
            .map(|row| ResearchCheckpointSignal {
                goal: row.get("goal"),
                summary: row.get("summary"),
                status: row.get("status"),
                updated_at: row.get("updated_at"),
                open_questions: parse_checkpoint_list(&row.get::<String, _>("open_questions")),
                next_steps: parse_checkpoint_list(&row.get::<String, _>("next_steps")),
            })
            .collect())
    }

    fn completed_tasks(base: &ResearchThemeBase) -> Vec<String> {
        [
            if base.paper_count > 0 {
                Some(format!("已导入 {} 篇论文", base.paper_count))
            } else {
                None
            },
            if base.note_count > 0 {
                Some(format!("已记录 {} 条笔记", base.note_count))
            } else {
                None
            },
        ]
        .into_iter()
        .flatten()
        .collect()
    }

    fn build_open_questions(
        base: &ResearchThemeBase,
        checkpoints: &[ResearchCheckpointSignal],
        events: &[ResearchActivityEvent],
    ) -> Vec<String> {
        let mut questions = Vec::new();
        let mut seen = HashSet::new();

        if let Some(checkpoint) = checkpoints.iter().find(|item| !item.open_questions.is_empty()) {
            for question in &checkpoint.open_questions {
                Self::push_unique_text(
                    &mut questions,
                    &mut seen,
                    question,
                    MAX_THEME_OPEN_QUESTIONS,
                );
            }
        }

        for event in events.iter().take(3) {
            if let Some(question) = Self::open_question_from_event(event) {
                Self::push_unique_text(
                    &mut questions,
                    &mut seen,
                    &question,
                    MAX_THEME_OPEN_QUESTIONS,
                );
            }
        }

        if questions.is_empty() {
            for question in Self::fallback_open_questions(base) {
                Self::push_unique_text(
                    &mut questions,
                    &mut seen,
                    &question,
                    MAX_THEME_OPEN_QUESTIONS,
                );
            }
        }

        questions
    }

    fn build_next_steps(
        base: &ResearchThemeBase,
        checkpoints: &[ResearchCheckpointSignal],
        events: &[ResearchActivityEvent],
    ) -> Vec<NextStep> {
        let mut steps = Vec::new();
        let mut seen = HashSet::new();

        if let Some(checkpoint) = checkpoints.iter().find(|item| !item.next_steps.is_empty()) {
            let description = Self::checkpoint_description(checkpoint);
            for title in &checkpoint.next_steps {
                Self::push_unique_step(
                    &mut steps,
                    &mut seen,
                    title,
                    description.as_deref(),
                    MAX_THEME_NEXT_STEPS,
                );
            }
        }

        for event in events.iter().take(3) {
            if let Some((title, description)) = Self::next_step_from_event(event) {
                Self::push_unique_step(
                    &mut steps,
                    &mut seen,
                    &title,
                    Some(&description),
                    MAX_THEME_NEXT_STEPS,
                );
            }
        }

        if steps.is_empty() {
            for step in Self::fallback_next_steps(base) {
                Self::push_unique_step(
                    &mut steps,
                    &mut seen,
                    &step.title,
                    step.description.as_deref(),
                    MAX_THEME_NEXT_STEPS,
                );
            }
        }

        steps
    }

    fn checkpoint_description(checkpoint: &ResearchCheckpointSignal) -> Option<String> {
        if checkpoint.status == "failed" && !checkpoint.summary.trim().is_empty() {
            return Some(format!("上次续接未完成：{}", preview_text(&checkpoint.summary, 60)));
        }

        if !checkpoint.summary.trim().is_empty() {
            return Some(preview_text(&checkpoint.summary, 72));
        }

        if !checkpoint.goal.trim().is_empty() {
            return Some(format!("延续最近一次对话目标：{}", preview_text(&checkpoint.goal, 40)));
        }

        if !checkpoint.updated_at.trim().is_empty() {
            return Some(format!("来自 {} 的最近研究续接点", short_timestamp(&checkpoint.updated_at)));
        }

        None
    }

    fn next_step_from_event(event: &ResearchActivityEvent) -> Option<(String, String)> {
        let title = preview_text(&event.title, 40);
        match event.event_type.as_str() {
            "paper_read" => Some((
                format!("继续拆解《{title}》的核心方法、实验设置与适用边界。"),
                "这是最近进入主题脉络的论文，适合优先补成精读笔记或方法对比。".to_string(),
            )),
            "note_added" => Some((
                format!("基于笔记《{title}》补齐证据、结论或待验证点。"),
                "最近已经有知识沉淀，下一步适合把它收敛成明确行动项。".to_string(),
            )),
            _ => None,
        }
    }

    fn open_question_from_event(event: &ResearchActivityEvent) -> Option<String> {
        let title = preview_text(&event.title, 40);
        match event.event_type.as_str() {
            "paper_read" => Some(format!(
                "围绕《{title}》，下一轮最值得优先核对的是方法假设、实验设置，还是结论边界？"
            )),
            "note_added" => Some(format!(
                "笔记《{title}》还缺哪类证据、反例或对比，才能支撑下一步判断？"
            )),
            _ => None,
        }
    }

    fn fallback_open_questions(base: &ResearchThemeBase) -> Vec<String> {
        if base.paper_count == 0 {
            return vec![format!(
                "主题「{}」最先要锁定的关键词、代表论文和问题边界分别是什么？",
                base.name
            )];
        }

        if base.note_count == 0 {
            return vec!["现有论文里，哪一篇最适合作为第一篇精读与拆解对象？".to_string()];
        }

        vec!["基于现有论文和笔记，当前最缺的是实验验证、方法对比，还是写作结构？".to_string()]
    }

    fn fallback_next_steps(base: &ResearchThemeBase) -> Vec<NextStep> {
        if base.paper_count == 0 {
            return vec![NextStep {
                title: "先导入 1-2 篇核心论文，建立这个主题的证据起点。".to_string(),
                description: Some(format!(
                    "当前主题还没有关联论文，可以先从「{}」的代表工作开始。",
                    base.name
                )),
            }];
        }

        if base.note_count == 0 {
            return vec![NextStep {
                title: "从已导入论文里选 1 篇做精读，并沉淀第一条研究笔记。".to_string(),
                description: Some(format!(
                    "当前已有 {} 篇论文入库，但还没有形成笔记沉淀。",
                    base.paper_count
                )),
            }];
        }

        vec![NextStep {
            title: "把现有论文和笔记收敛成一个明确的实验、写作或对比任务。".to_string(),
            description: Some(format!(
                "现在已有 {} 篇论文、{} 条笔记，可以继续推进更具体的研究动作。",
                base.paper_count, base.note_count
            )),
        }]
    }

    fn push_unique_text(
        items: &mut Vec<String>,
        seen: &mut HashSet<String>,
        value: &str,
        limit: usize,
    ) {
        if items.len() >= limit {
            return;
        }

        let normalized = compact_text(value);
        if normalized.is_empty() {
            return;
        }

        let key = normalized.to_lowercase();
        if seen.insert(key) {
            items.push(normalized);
        }
    }

    fn push_unique_step(
        items: &mut Vec<NextStep>,
        seen: &mut HashSet<String>,
        title: &str,
        description: Option<&str>,
        limit: usize,
    ) {
        if items.len() >= limit {
            return;
        }

        let normalized_title = compact_text(title);
        if normalized_title.is_empty() {
            return;
        }

        let key = normalized_title.to_lowercase();
        if !seen.insert(key) {
            return;
        }

        let normalized_description = description
            .map(compact_text)
            .filter(|value| !value.is_empty());

        items.push(NextStep {
            title: normalized_title,
            description: normalized_description,
        });
    }
}

fn join_or_fallback(values: &[String], fallback: &str) -> String {
    if values.is_empty() {
        fallback.to_string()
    } else {
        values.join("、")
    }
}

fn short_timestamp(value: &str) -> String {
    if value.len() >= 16 {
        value[5..16].to_string()
    } else {
        value.to_string()
    }
}

fn preview_text(value: &str, max_chars: usize) -> String {
    let compact = compact_text(value);
    let length = compact.chars().count();
    if length <= max_chars {
        compact
    } else {
        format!("{}…", compact.chars().take(max_chars).collect::<String>())
    }
}

fn compact_text(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
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
                open_questions: vec!["尚未提炼出明确开放问题。".to_string()],
                next_steps: vec![NextStep {
                    title: "先整理这个主题当前最想推进的问题与现有材料。".to_string(),
                    description: None,
                }],
            },
            events: vec![],
        });

    let next_steps = ctx
        .theme
        .next_steps
        .iter()
        .take(2)
        .map(|step| step.title.clone())
        .collect::<Vec<_>>();
    let recent_events = ctx
        .events
        .iter()
        .take(2)
        .map(|event| preview_text(&event.title, 28))
        .collect::<Vec<_>>();

    format!(
        "研究主题：{}\n已完成：{}\n建议下一步：{}\n待解决：{}\n近期活动：{}",
        ctx.theme.name,
        join_or_fallback(&ctx.theme.completed_tasks, "暂无明确里程碑"),
        join_or_fallback(&next_steps, "继续从当前主题目标切入"),
        join_or_fallback(&ctx.theme.open_questions, "暂无明显阻塞，可直接推进最近任务"),
        join_or_fallback(&recent_events, "暂无活动记录"),
    )
}

#[cfg(test)]
mod tests {
    use super::ResearchContextService;
    use crate::db::ensure_memory_checkpoint_tables;
    use anyhow::Result;
    use sqlx::{
        sqlite::{SqliteConnectOptions, SqlitePoolOptions},
        SqlitePool,
    };
    use std::str::FromStr;

    async fn test_pool() -> Result<SqlitePool> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")?
            .create_if_missing(true)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;

        sqlx::raw_sql(
            "CREATE TABLE research_interests (
                id          TEXT PRIMARY KEY,
                topic       TEXT NOT NULL,
                folder_name TEXT,
                created_at  TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE papers (
                id                   TEXT PRIMARY KEY,
                title                TEXT NOT NULL,
                research_interest_id TEXT,
                created_at           TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE knowledge_notes (
                id                   TEXT PRIMARY KEY,
                research_interest_id TEXT,
                title                TEXT NOT NULL,
                content              TEXT NOT NULL DEFAULT '',
                created_at           TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE chat_sessions (
                id           TEXT PRIMARY KEY,
                title        TEXT NOT NULL DEFAULT 'session',
                context_type TEXT NOT NULL DEFAULT 'general',
                context_id   TEXT,
                created_at   TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );"
        )
        .execute(&pool)
        .await?;

        ensure_memory_checkpoint_tables(&pool).await?;

        Ok(pool)
    }

    #[tokio::test]
    async fn theme_context_prefers_checkpoint_signals_for_open_questions_and_next_steps() -> Result<()> {
        let pool = test_pool().await?;

        sqlx::query(
            "INSERT INTO research_interests (id, topic, folder_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind("interest-1")
        .bind("Graph RAG")
        .bind("Graph RAG")
        .bind("2026-06-08 09:00:00")
        .bind("2026-06-08 10:00:00")
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO chat_sessions (id, title, context_type, context_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind("session-1")
        .bind("session")
        .bind("interest")
        .bind("interest-1")
        .bind("2026-06-08 09:30:00")
        .bind("2026-06-08 09:30:00")
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO memory_session_summaries (
                id, session_id, request_id, context_type, context_id, goal, summary,
                completed_items, open_questions, next_steps, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind("checkpoint-1")
        .bind("session-1")
        .bind("request-1")
        .bind("interest")
        .bind("interest-1")
        .bind("规划 Graph RAG 复现路线")
        .bind("已经整理了可复现的候选论文，接下来需要确定首篇精读对象。")
        .bind("[]")
        .bind("[\"首篇精读样本应该优先选哪篇论文？\"]")
        .bind("[\"先确认首篇精读论文，并把比较维度列出来。\"]")
        .bind("completed")
        .bind("2026-06-08 09:40:00")
        .bind("2026-06-08 09:40:00")
        .execute(&pool)
        .await?;

        let context = ResearchContextService::get_theme_context(&pool, "interest-1").await?;

        assert_eq!(context.theme.open_questions.len(), 1);
        assert_eq!(
            context.theme.open_questions[0],
            "首篇精读样本应该优先选哪篇论文？"
        );
        assert_eq!(context.theme.next_steps.len(), 1);
        assert_eq!(
            context.theme.next_steps[0].title,
            "先确认首篇精读论文，并把比较维度列出来。"
        );
        assert!(context.theme.next_steps[0]
            .description
            .as_deref()
            .unwrap_or_default()
            .contains("已经整理了可复现的候选论文"));

        Ok(())
    }

    #[tokio::test]
    async fn theme_context_falls_back_to_recent_assets_when_checkpoint_missing() -> Result<()> {
        let pool = test_pool().await?;

        sqlx::query(
            "INSERT INTO research_interests (id, topic, folder_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)"
        )
        .bind("interest-2")
        .bind("Multimodal Agents")
        .bind("Multimodal Agents")
        .bind("2026-06-08 08:00:00")
        .bind("2026-06-08 11:00:00")
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO papers (id, title, research_interest_id, created_at)
             VALUES (?, ?, ?, ?)"
        )
        .bind("paper-1")
        .bind("Vision-Language Agent Planning")
        .bind("interest-2")
        .bind("2026-06-08 10:00:00")
        .execute(&pool)
        .await?;

        let context = ResearchContextService::get_theme_context(&pool, "interest-2").await?;

        assert!(!context.theme.open_questions.is_empty());
        assert!(!context.theme.next_steps.is_empty());
        assert!(context.theme.open_questions[0].contains("Vision-Language Agent Planning"));
        assert!(context.theme.next_steps[0]
            .title
            .contains("Vision-Language Agent Planning"));
        assert_eq!(context.events.len(), 1);

        Ok(())
    }
}
