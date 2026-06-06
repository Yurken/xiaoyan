use serde::{Deserialize, Serialize};

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
    pub fn get_recent_themes(limit: usize) -> Result<Vec<ResearchTheme>, String> {
        let themes = vec![
            ResearchTheme {
                id: "theme_1".into(),
                name: "Agent 协同规划与自我反思机制".into(),
                last_active_at: "2026-05-30T10:00:00Z".into(),
                completed_tasks: vec!["阅读相关文献 3 篇".into(), "构建初始 Prompt".into()],
                open_questions: vec!["如何量化反思质量？".into()],
                next_steps: vec![NextStep {
                    title: "设计对比实验".into(),
                    description: Some("对比无反思与有反思 Agent 在逻辑推理上的表现".into()),
                }],
            },
            ResearchTheme {
                id: "theme_2".into(),
                name: "长文本模型中的注意力漂移问题".into(),
                last_active_at: "2026-05-29T15:30:00Z".into(),
                completed_tasks: vec!["收集数据集".into()],
                open_questions: vec!["注意力惩罚项的最佳权重是多少？".into()],
                next_steps: vec![NextStep {
                    title: "阅读新出炉的 RoPE 论文".into(),
                    description: None,
                }],
            },
        ];

        Ok(themes.into_iter().take(limit).collect())
    }

    pub fn get_theme_context(theme_id: &str) -> Result<ResearchThemeContext, String> {
        let theme = Self::get_recent_themes(10)?
            .into_iter()
            .find(|t| t.id == theme_id)
            .unwrap_or_else(|| ResearchTheme {
                id: theme_id.into(),
                name: "未命名主题".into(),
                last_active_at: "2026-05-30T00:00:00Z".into(),
                completed_tasks: vec![],
                open_questions: vec![],
                next_steps: vec![],
            });

        let events = vec![
            ResearchActivityEvent {
                id: "event_1".into(),
                theme_id: theme_id.into(),
                event_type: "paper_read".into(),
                title: "阅读了文献 AgentVerse".into(),
                timestamp: "2026-05-30T09:00:00Z".into(),
            },
            ResearchActivityEvent {
                id: "event_2".into(),
                theme_id: theme_id.into(),
                event_type: "note_added".into(),
                title: "添加了关于 Agent 评估的笔记".into(),
                timestamp: "2026-05-30T09:30:00Z".into(),
            },
        ];

        Ok(ResearchThemeContext { theme, events })
    }
}


pub async fn build_research_context_summary(
    _db: &sqlx::SqlitePool,
    interest_id: &str,
) -> String {
    let ctx = ResearchContextService::get_theme_context(interest_id).unwrap_or_else(|_| {
        ResearchThemeContext {
            theme: ResearchTheme {
                id: interest_id.to_string(),
                name: "未知主题".to_string(),
                last_active_at: String::new(),
                completed_tasks: vec![],
                open_questions: vec![],
                next_steps: vec![],
            },
            events: vec![],
        }
    });
    format!(
        "研究主题：{}\n已完成：{}\n待解决：{}",
        ctx.theme.name,
        ctx.theme.completed_tasks.join("、"),
        ctx.theme.open_questions.join("、"),
    )
}
