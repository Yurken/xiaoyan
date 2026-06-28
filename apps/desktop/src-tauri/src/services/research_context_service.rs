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
    /// 主题路线是否已规划成形，用于前端推导研究进展阶梯。
    pub planned: bool,
    /// 主题在各模块下的真实工作量，驱动「研究进展」可视化。
    pub progress: ResearchThemeProgress,
    #[serde(rename = "completedTasks")]
    pub completed_tasks: Vec<String>,
    #[serde(rename = "openQuestions")]
    pub open_questions: Vec<String>,
    #[serde(rename = "nextSteps")]
    pub next_steps: Vec<NextStep>,
}

/// 一个研究主题在各功能模块下沉淀的计数，前端据此展示阶段进展与模块直达。
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ResearchThemeProgress {
    #[serde(rename = "paperCount")]
    pub paper_count: i64,
    #[serde(rename = "analyzedPaperCount")]
    pub analyzed_paper_count: i64,
    #[serde(rename = "noteCount")]
    pub note_count: i64,
    #[serde(rename = "sessionCount")]
    pub session_count: i64,
    #[serde(rename = "experimentCount")]
    pub experiment_count: i64,
    #[serde(rename = "submissionCount")]
    pub submission_count: i64,
    #[serde(rename = "claimCount")]
    pub claim_count: i64,
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
    status: String,
    last_active_at: String,
    progress: ResearchThemeProgress,
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

/// 主题最近活动时间：取主题自身创建时间与各模块最新动作的最大值，
/// 让「最近活动」真实反映用户在论文 / 笔记 / 对话里的推进，而不是停留在创建时刻。
/// 注意：research_interests 表没有 updated_at 列，不能直接引用它。
const THEME_LAST_ACTIVE_EXPR: &str = "MAX(
        ri.created_at,
        COALESCE((SELECT MAX(created_at) FROM papers WHERE research_interest_id = ri.id), ri.created_at),
        COALESCE((SELECT MAX(created_at) FROM knowledge_notes WHERE research_interest_id = ri.id), ri.created_at),
        COALESCE((SELECT MAX(COALESCE(updated_at, created_at)) FROM chat_sessions WHERE context_type = 'interest' AND context_id = ri.id), ri.created_at)
    )";

/// 主题在各功能模块下的计数子查询，与 ResearchThemeProgress 字段一一对应。
/// 实验、投稿没有直接外键，通过「主张 → 证据链 → 实验 → 关联投稿」聚合得到。
const THEME_PROGRESS_COLUMNS: &str = "(SELECT COUNT(*) FROM papers p WHERE p.research_interest_id = ri.id) as paper_count,
        (SELECT COUNT(*) FROM papers p WHERE p.research_interest_id = ri.id AND EXISTS(SELECT 1 FROM paper_analyses pa WHERE pa.paper_id = p.id)) as analyzed_paper_count,
        (SELECT COUNT(*) FROM knowledge_notes n WHERE n.research_interest_id = ri.id) as note_count,
        (SELECT COUNT(*) FROM chat_sessions s WHERE s.context_type = 'interest' AND s.context_id = ri.id) as session_count,
        (SELECT COUNT(*) FROM knowledge_graph_claims c WHERE c.research_interest_id = ri.id) as claim_count,
        (SELECT COUNT(DISTINCT el.source_id) FROM knowledge_graph_evidence_links el JOIN knowledge_graph_claims c ON c.id = el.claim_id WHERE c.research_interest_id = ri.id AND el.source_kind = 'experiment') as experiment_count,
        (SELECT COUNT(DISTINCT er.linked_submission_id) FROM experiment_records er WHERE er.linked_submission_id IS NOT NULL AND er.id IN (SELECT el.source_id FROM knowledge_graph_evidence_links el JOIN knowledge_graph_claims c ON c.id = el.claim_id WHERE c.research_interest_id = ri.id AND el.source_kind = 'experiment')) as submission_count";

impl ResearchContextService {
    pub async fn get_recent_themes(
        db: &sqlx::SqlitePool,
        limit: usize,
    ) -> Result<Vec<ResearchTheme>, String> {
        let sql = format!(
            "SELECT ri.id, ri.topic, ri.folder_name, ri.status,
                    {last_active} as last_active,
                    {progress}
             FROM research_interests ri
             ORDER BY last_active DESC
             LIMIT ?",
            last_active = THEME_LAST_ACTIVE_EXPR,
            progress = THEME_PROGRESS_COLUMNS,
        );
        let rows = sqlx::query(&sql)
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
        let sql = format!(
            "SELECT ri.id, ri.topic, ri.folder_name, ri.status,
                    {last_active} as last_active,
                    {progress}
             FROM research_interests ri WHERE ri.id = ?",
            last_active = THEME_LAST_ACTIVE_EXPR,
            progress = THEME_PROGRESS_COLUMNS,
        );
        let row = sqlx::query(&sql)
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
            status: row.get("status"),
            last_active_at: row.get("last_active"),
            progress: ResearchThemeProgress {
                paper_count: row.get("paper_count"),
                analyzed_paper_count: row.get("analyzed_paper_count"),
                note_count: row.get("note_count"),
                session_count: row.get("session_count"),
                experiment_count: row.get("experiment_count"),
                submission_count: row.get("submission_count"),
                claim_count: row.get("claim_count"),
            },
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
        let planned = base.status == "planned";

        ResearchTheme {
            id: base.id,
            name: base.name,
            last_active_at: base.last_active_at,
            planned,
            progress: base.progress,
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
            status: String::new(),
            last_active_at: String::new(),
            progress: ResearchThemeProgress::default(),
        };
        let open_questions = Self::fallback_open_questions(&base);
        let next_steps = Self::fallback_next_steps(&base);

        ResearchTheme {
            id: base.id,
            name: base.name,
            last_active_at: base.last_active_at,
            planned: false,
            progress: base.progress,
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
             ORDER BY created_at DESC LIMIT 5",
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
             ORDER BY created_at DESC LIMIT 5",
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

        // Recent experiments linked to this theme via the knowledge-graph evidence chain
        let experiment_rows = sqlx::query(
            "SELECT DISTINCT er.id, er.title, er.created_at
             FROM experiment_records er
             JOIN knowledge_graph_evidence_links el
               ON el.source_id = er.id AND el.source_kind = 'experiment'
             JOIN knowledge_graph_claims c ON c.id = el.claim_id
             WHERE c.research_interest_id = ?
             ORDER BY er.created_at DESC LIMIT 5",
        )
        .bind(theme_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for row in experiment_rows {
            let id: String = row.get("id");
            let title: String = row.get("title");
            let created_at: String = row.get("created_at");
            events.push(ResearchActivityEvent {
                id,
                theme_id: theme_id.to_string(),
                event_type: "experiment_logged".into(),
                title,
                timestamp: created_at,
            });
        }

        // Recent submissions reached through this theme's experiments
        let submission_rows = sqlx::query(
            "SELECT DISTINCT s.id, s.title, COALESCE(s.updated_at, s.created_at) as ts
             FROM submissions s
             JOIN experiment_records er ON er.linked_submission_id = s.id
             JOIN knowledge_graph_evidence_links el
               ON el.source_id = er.id AND el.source_kind = 'experiment'
             JOIN knowledge_graph_claims c ON c.id = el.claim_id
             WHERE c.research_interest_id = ?
             ORDER BY ts DESC LIMIT 5",
        )
        .bind(theme_id)
        .fetch_all(db)
        .await
        .map_err(|e| e.to_string())?;

        for row in submission_rows {
            let id: String = row.get("id");
            let title: String = row.get("title");
            let ts: String = row.get("ts");
            events.push(ResearchActivityEvent {
                id,
                theme_id: theme_id.to_string(),
                event_type: "submission_updated".into(),
                title,
                timestamp: ts,
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
             LIMIT ?",
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
        let p = &base.progress;
        [
            (p.paper_count > 0).then(|| format!("已导入 {} 篇论文", p.paper_count)),
            (p.analyzed_paper_count > 0)
                .then(|| format!("已解读 {} 篇论文", p.analyzed_paper_count)),
            (p.note_count > 0).then(|| format!("已记录 {} 条笔记", p.note_count)),
            (p.session_count > 0).then(|| format!("已展开 {} 次主题对话", p.session_count)),
            (p.experiment_count > 0).then(|| format!("已关联 {} 个实验记录", p.experiment_count)),
            (p.submission_count > 0).then(|| format!("已推进 {} 个投稿", p.submission_count)),
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

        if let Some(checkpoint) = checkpoints
            .iter()
            .find(|item| !item.open_questions.is_empty())
        {
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
            return Some(format!(
                "上次续接未完成：{}",
                preview_text(&checkpoint.summary, 60)
            ));
        }

        if !checkpoint.summary.trim().is_empty() {
            return Some(preview_text(&checkpoint.summary, 72));
        }

        if !checkpoint.goal.trim().is_empty() {
            return Some(format!(
                "延续最近一次对话目标：{}",
                preview_text(&checkpoint.goal, 40)
            ));
        }

        if !checkpoint.updated_at.trim().is_empty() {
            return Some(format!(
                "来自 {} 的最近研究续接点",
                short_timestamp(&checkpoint.updated_at)
            ));
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
        if base.progress.paper_count == 0 {
            return vec![format!(
                "主题「{}」最先要锁定的关键词、代表论文和问题边界分别是什么？",
                base.name
            )];
        }

        if base.progress.note_count == 0 {
            return vec!["现有论文里，哪一篇最适合作为第一篇精读与拆解对象？".to_string()];
        }

        vec!["基于现有论文和笔记，当前最缺的是实验验证、方法对比，还是写作结构？".to_string()]
    }

    fn fallback_next_steps(base: &ResearchThemeBase) -> Vec<NextStep> {
        if base.progress.paper_count == 0 {
            return vec![NextStep {
                title: "先导入 1-2 篇核心论文，建立这个主题的证据起点。".to_string(),
                description: Some(format!(
                    "当前主题还没有关联论文，可以先从「{}」的代表工作开始。",
                    base.name
                )),
            }];
        }

        if base.progress.note_count == 0 {
            return vec![NextStep {
                title: "从已导入论文里选 1 篇做精读，并沉淀第一条研究笔记。".to_string(),
                description: Some(format!(
                    "当前已有 {} 篇论文入库，但还没有形成笔记沉淀。",
                    base.progress.paper_count
                )),
            }];
        }

        vec![NextStep {
            title: "把现有论文和笔记收敛成一个明确的实验、写作或对比任务。".to_string(),
            description: Some(format!(
                "现在已有 {} 篇论文、{} 条笔记，可以继续推进更具体的研究动作。",
                base.progress.paper_count, base.progress.note_count
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

pub async fn build_research_context_summary(db: &sqlx::SqlitePool, interest_id: &str) -> String {
    let ctx = ResearchContextService::get_theme_context(db, interest_id)
        .await
        .unwrap_or_else(|_| ResearchThemeContext {
            theme: ResearchTheme {
                id: interest_id.to_string(),
                name: "未知主题".to_string(),
                last_active_at: String::new(),
                planned: false,
                progress: ResearchThemeProgress::default(),
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
        join_or_fallback(
            &ctx.theme.open_questions,
            "暂无明显阻塞，可直接推进最近任务"
        ),
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

        // 刻意贴近生产 schema：research_interests 没有 updated_at 列（只有 status / created_at），
        // 以此回归守护「最近活动查询误引用 updated_at 导致命令报错」的问题。
        sqlx::raw_sql(
            "CREATE TABLE research_interests (
                id          TEXT PRIMARY KEY,
                topic       TEXT NOT NULL,
                folder_name TEXT,
                status      TEXT NOT NULL DEFAULT 'active',
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE papers (
                id                   TEXT PRIMARY KEY,
                title                TEXT NOT NULL,
                research_interest_id TEXT,
                created_at           TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE paper_analyses (
                id         TEXT PRIMARY KEY,
                paper_id   TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
            );
            CREATE TABLE knowledge_graph_claims (
                id                   TEXT PRIMARY KEY,
                title                TEXT NOT NULL,
                research_interest_id TEXT,
                created_at           TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE knowledge_graph_evidence_links (
                id          TEXT PRIMARY KEY,
                claim_id    TEXT NOT NULL,
                source_kind TEXT NOT NULL,
                source_id   TEXT NOT NULL,
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE experiment_records (
                id                   TEXT PRIMARY KEY,
                title                TEXT NOT NULL,
                linked_submission_id TEXT,
                created_at           TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE submissions (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT
            );",
        )
        .execute(&pool)
        .await?;

        ensure_memory_checkpoint_tables(&pool).await?;

        Ok(pool)
    }

    #[tokio::test]
    async fn theme_context_prefers_checkpoint_signals_for_open_questions_and_next_steps(
    ) -> Result<()> {
        let pool = test_pool().await?;

        sqlx::query(
            "INSERT INTO research_interests (id, topic, folder_name, status, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind("interest-1")
        .bind("Graph RAG")
        .bind("Graph RAG")
        .bind("planned")
        .bind("2026-06-08 09:00:00")
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
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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

        let context = ResearchContextService::get_theme_context(&pool, "interest-1")
            .await
            .map_err(anyhow::Error::msg)?;

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
            "INSERT INTO research_interests (id, topic, folder_name, status, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind("interest-2")
        .bind("Multimodal Agents")
        .bind("Multimodal Agents")
        .bind("planned")
        .bind("2026-06-08 08:00:00")
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO papers (id, title, research_interest_id, created_at)
             VALUES (?, ?, ?, ?)",
        )
        .bind("paper-1")
        .bind("Vision-Language Agent Planning")
        .bind("interest-2")
        .bind("2026-06-08 10:00:00")
        .execute(&pool)
        .await?;

        let context = ResearchContextService::get_theme_context(&pool, "interest-2")
            .await
            .map_err(anyhow::Error::msg)?;

        assert!(!context.theme.open_questions.is_empty());
        assert!(!context.theme.next_steps.is_empty());
        assert!(context.theme.open_questions[0].contains("Vision-Language Agent Planning"));
        assert!(context.theme.next_steps[0]
            .title
            .contains("Vision-Language Agent Planning"));
        assert_eq!(context.events.len(), 1);

        Ok(())
    }

    #[tokio::test]
    async fn theme_context_aggregates_progress_across_modules() -> Result<()> {
        let pool = test_pool().await?;

        sqlx::query(
            "INSERT INTO research_interests (id, topic, folder_name, status, created_at)
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind("interest-3")
        .bind("Diffusion Policies")
        .bind("Diffusion Policies")
        .bind("planned")
        .bind("2026-06-08 08:00:00")
        .execute(&pool)
        .await?;

        for (id, ts) in [
            ("paper-a", "2026-06-08 09:00:00"),
            ("paper-b", "2026-06-08 09:30:00"),
        ] {
            sqlx::query(
                "INSERT INTO papers (id, title, research_interest_id, created_at) VALUES (?, ?, ?, ?)",
            )
            .bind(id)
            .bind(format!("Paper {id}"))
            .bind("interest-3")
            .bind(ts)
            .execute(&pool)
            .await?;
        }

        // 仅 paper-a 有解读结果，analyzed_paper_count 应为 1。
        sqlx::query("INSERT INTO paper_analyses (id, paper_id) VALUES (?, ?)")
            .bind("analysis-a")
            .bind("paper-a")
            .execute(&pool)
            .await?;

        sqlx::query(
            "INSERT INTO knowledge_notes (id, research_interest_id, title, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind("note-a")
        .bind("interest-3")
        .bind("第一条笔记")
        .bind("2026-06-08 10:00:00")
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO chat_sessions (id, title, context_type, context_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind("session-a")
        .bind("会话")
        .bind("interest")
        .bind("interest-3")
        .bind("2026-06-08 10:30:00")
        .bind("2026-06-08 11:00:00")
        .execute(&pool)
        .await?;

        // 实验 / 投稿通过「主张 → 证据链 → 实验 → 关联投稿」串联到主题。
        sqlx::query(
            "INSERT INTO knowledge_graph_claims (id, title, research_interest_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind("claim-a")
        .bind("核心主张")
        .bind("interest-3")
        .bind("2026-06-08 11:30:00")
        .execute(&pool)
        .await?;
        sqlx::query(
            "INSERT INTO submissions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        )
        .bind("sub-a")
        .bind("投到顶会")
        .bind("2026-06-08 12:00:00")
        .bind("2026-06-08 12:30:00")
        .execute(&pool)
        .await?;
        sqlx::query(
            "INSERT INTO experiment_records (id, title, linked_submission_id, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind("exp-a")
        .bind("主实验")
        .bind("sub-a")
        .bind("2026-06-08 11:45:00")
        .execute(&pool)
        .await?;
        sqlx::query(
            "INSERT INTO knowledge_graph_evidence_links (id, claim_id, source_kind, source_id) VALUES (?, ?, ?, ?)",
        )
        .bind("link-a")
        .bind("claim-a")
        .bind("experiment")
        .bind("exp-a")
        .execute(&pool)
        .await?;

        let context = ResearchContextService::get_theme_context(&pool, "interest-3")
            .await
            .map_err(anyhow::Error::msg)?;

        assert!(context.theme.planned);
        let progress = &context.theme.progress;
        assert_eq!(progress.paper_count, 2);
        assert_eq!(progress.analyzed_paper_count, 1);
        assert_eq!(progress.note_count, 1);
        assert_eq!(progress.session_count, 1);
        assert_eq!(progress.claim_count, 1);
        assert_eq!(progress.experiment_count, 1);
        assert_eq!(progress.submission_count, 1);

        // 时间线纳入实验与投稿活动，让用户看到跨模块进展。
        assert!(context
            .events
            .iter()
            .any(|event| event.event_type == "experiment_logged"));
        assert!(context
            .events
            .iter()
            .any(|event| event.event_type == "submission_updated"));

        // 已完成里程碑覆盖多个模块。
        assert!(context
            .theme
            .completed_tasks
            .iter()
            .any(|task| task.contains("解读")));
        assert!(context
            .theme
            .completed_tasks
            .iter()
            .any(|task| task.contains("投稿")));

        // get_recent_themes 走相同的查询路径，确保不再误引用 research_interests.updated_at。
        let recent = ResearchContextService::get_recent_themes(&pool, 5)
            .await
            .map_err(anyhow::Error::msg)?;
        assert!(recent.iter().any(|theme| theme.id == "interest-3"));

        Ok(())
    }
}
