//! 动作路由服务
//!
//! 解读、翻译、对话、导入的路由和执行
//! 所有落库逻辑统一在此层完成，command 层只做参数校验和调用

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::llm::{LlmClient, LlmMessage};
use super::permission_service::PermissionService;

/// 助手动作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssistantAction {
    Interpret,
    Translate,
    Chat,
    Import,
}

/// 导入目标类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImportTarget {
    Note,
    Image,
    Paper,
    Later,
}

impl std::fmt::Display for ImportTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ImportTarget::Note => write!(f, "note"),
            ImportTarget::Image => write!(f, "image"),
            ImportTarget::Paper => write!(f, "paper"),
            ImportTarget::Later => write!(f, "later"),
        }
    }
}

impl std::str::FromStr for ImportTarget {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s.to_lowercase().as_str() {
            "note" => Ok(ImportTarget::Note),
            "image" => Ok(ImportTarget::Image),
            "paper" => Ok(ImportTarget::Paper),
            "later" => Ok(ImportTarget::Later),
            _ => Err(anyhow!("Unknown import target: {}", s)),
        }
    }
}

/// 动作结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResult {
    pub id: String,
    pub session_id: String,
    pub action: AssistantAction,
    pub content: String,
    pub format: String,
    pub metadata: Option<ActionMetadata>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// 动作结果元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionMetadata {
    pub model: Option<String>,
    pub token_usage: Option<u32>,
    pub duration_ms: Option<u64>,
    pub sources: Option<Vec<String>>,
}

/// 动作服务
pub struct ActionService;

impl ActionService {
    /// 执行解读动作
    pub async fn interpret(
        llm: &LlmClient,
        session_id: &str,
        content: &str,
        question: Option<&str>,
    ) -> Result<ActionResult> {
        // 对内容进行脱敏处理
        let sanitized_content = PermissionService::sanitize_content(content);

        let system_prompt = "你是一位学术研究助手。请对以下内容进行学术解读。

解读要求：
1. **要点总结**：用 2-3 句话概括核心内容
2. **通俗解释**：用非专业人士能理解的语言解释
3. **研究关联**：如果可能，指出与学术研究的关联

请用 Markdown 格式输出，使用清晰的标题分隔各部分。";

        let user_prompt = if let Some(q) = question {
            format!("请解读以下内容，并回答问题：{}\n\n---\n\n{}", q, sanitized_content)
        } else {
            format!("请解读以下内容：\n\n---\n\n{}", sanitized_content)
        };

        let messages = vec![
            LlmMessage::system(system_prompt),
            LlmMessage::user(&user_prompt),
        ];

        let start = std::time::Instant::now();
        let result = llm
            .stream_chat(&messages, None, 0.7, |_| {})
            .await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Interpret,
            content: result,
            format: "markdown".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: Some(duration_ms),
                sources: None,
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 执行翻译动作
    pub async fn translate(
        llm: &LlmClient,
        session_id: &str,
        content: &str,
        target_lang: Option<&str>,
    ) -> Result<ActionResult> {
        let lang = target_lang.unwrap_or("中文");
        let system_prompt = format!(
            "你是一位专业翻译。请将以下内容翻译成{}。

翻译要求：
1. 保持原文的学术性和专业性
2. 专业术语保留英文原文，并在括号中给出翻译
3. 输出格式：先显示译文，然后列出关键术语对照表

请用 Markdown 格式输出。",
            lang
        );

        // 对内容进行脱敏处理
        let sanitized_content = PermissionService::sanitize_content(content);

        let messages = vec![
            LlmMessage::system(&system_prompt),
            LlmMessage::user(&sanitized_content),
        ];

        let start = std::time::Instant::now();
        let result = llm
            .stream_chat(&messages, None, 0.3, |_| {})
            .await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Translate,
            content: result,
            format: "markdown".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: Some(duration_ms),
                sources: None,
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 执行对话动作
    pub async fn chat(
        llm: &LlmClient,
        session_id: &str,
        context: &str,
        question: &str,
    ) -> Result<ActionResult> {
        // 对内容进行脱敏处理
        let sanitized_context = PermissionService::sanitize_content(context);

        let system_prompt = "你是一位学术研究助手。用户会提供一段上下文内容，并基于此提出问题。

请根据上下文内容回答用户的问题。如果上下文中没有足够的信息，请如实说明。

回答要求：
1. 基于上下文内容回答
2. 引用上下文中的具体部分
3. 如果需要，可以提供额外的背景知识

请用清晰、专业的方式回答。";

        let user_prompt = format!(
            "上下文内容：\n\n---\n\n{}\n\n---\n\n我的问题：{}",
            sanitized_context, question
        );

        let messages = vec![
            LlmMessage::system(system_prompt),
            LlmMessage::user(&user_prompt),
        ];

        let start = std::time::Instant::now();
        let result = llm
            .stream_chat(&messages, None, 0.7, |_| {})
            .await?;
        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Chat,
            content: result,
            format: "markdown".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: Some(duration_ms),
                sources: None,
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 执行导入动作（统一落库逻辑）
    pub async fn import(
        db: &SqlitePool,
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
        target: &str,
        title: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<ActionResult> {
        let target_enum: ImportTarget = target.parse()?;

        match target_enum {
            ImportTarget::Note => Self::import_as_note(db, session_id, content, title, tags).await,
            ImportTarget::Image => Self::import_as_image(app_data_dir, session_id, content, title).await,
            ImportTarget::Paper => Self::import_as_paper(db, session_id, content, title).await,
            ImportTarget::Later => Self::import_as_later(db, session_id, content, title).await,
        }
    }

    /// 导入为知识笔记
    async fn import_as_note(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
        tags: Option<&[String]>,
    ) -> Result<ActionResult> {
        let note_title = match title {
            Some(t) => t.to_string(),
            None => {
                let preview: String = content.chars().take(50).collect();
                format!("从悬浮助手导入 - {}", preview)
            }
        };

        let tags_str = tags
            .unwrap_or(&[])
            .iter()
            .map(|t| t.as_str())
            .collect::<Vec<_>>()
            .join(",");

        let note_id = sqlx::query_scalar::<_, String>(
            "INSERT INTO knowledge_notes (title, content, tags, source_type, source_id, created_at, updated_at) VALUES (?, ?, ?, 'assistant', ?, datetime('now'), datetime('now')) RETURNING id"
        )
        .bind(&note_title)
        .bind(content)
        .bind(&tags_str)
        .bind(session_id)
        .fetch_optional(db)
        .await?
        .unwrap_or_default();

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Import,
            content: format!("已保存为知识笔记\n\nID: {}\n标题: {}", note_id, note_title),
            format: "text".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: None,
                sources: Some(vec![format!("note:{}", note_id)]),
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 导入为图片资产
    async fn import_as_image(
        app_data_dir: &std::path::Path,
        session_id: &str,
        content: &str,
        _title: Option<&str>,
    ) -> Result<ActionResult> {
        let asset_id = Uuid::new_v4().to_string();

        // content 应该是 base64 编码的图片数据
        let image_data = if content.starts_with("data:image") {
            // 处理 data URL
            let base64_data = content.split(',').nth(1).unwrap_or(content);
            base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                base64_data,
            )?
        } else {
            // 尝试直接作为 base64 解码
            base64::Engine::decode(
                &base64::engine::general_purpose::STANDARD,
                content,
            )?
        };

        // 保存图片到本地
        let image_path = Self::save_image(app_data_dir, &asset_id, &image_data)?;

        Ok(ActionResult {
            id: asset_id.clone(),
            session_id: session_id.to_string(),
            action: AssistantAction::Import,
            content: format!("截图已保存\n\nID: {}\n路径: {}", asset_id, image_path.display()),
            format: "text".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: None,
                sources: Some(vec![format!("image:{}", asset_id)]),
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 导入为论文候选
    async fn import_as_paper(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
    ) -> Result<ActionResult> {
        let paper_title = match title {
            Some(t) => t.to_string(),
            None => {
                let preview: String = content.chars().take(100).collect();
                format!("从悬浮助手导入 - {}", preview)
            }
        };

        let content_preview: String = content.chars().take(500).collect();

        let candidate_id = sqlx::query_scalar::<_, String>(
            "INSERT INTO assistant_paper_candidates (id, session_id, title, content_preview, status, created_at) VALUES (?, ?, ?, ?, 'pending', datetime('now')) RETURNING id"
        )
        .bind(Uuid::new_v4().to_string())
        .bind(session_id)
        .bind(&paper_title)
        .bind(&content_preview)
        .fetch_optional(db)
        .await?
        .unwrap_or_default();

        Ok(ActionResult {
            id: candidate_id.clone(),
            session_id: session_id.to_string(),
            action: AssistantAction::Import,
            content: format!("已创建论文导入候选\n\nID: {}\n标题: {}\n请在论文库中完成导入", candidate_id, paper_title),
            format: "text".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: None,
                sources: Some(vec![format!("paper:{}", candidate_id)]),
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 导入为稍后处理
    async fn import_as_later(
        db: &SqlitePool,
        session_id: &str,
        content: &str,
        title: Option<&str>,
    ) -> Result<ActionResult> {
        let later_title = match title {
            Some(t) => t.to_string(),
            None => {
                let preview: String = content.chars().take(50).collect();
                format!("稍后处理 - {}", preview)
            }
        };

        let item_id = sqlx::query_scalar::<_, String>(
            "INSERT INTO assistant_later_items (title, content, session_id, created_at) VALUES (?, ?, ?, datetime('now')) RETURNING id"
        )
        .bind(&later_title)
        .bind(content)
        .bind(session_id)
        .fetch_optional(db)
        .await?
        .unwrap_or_default();

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Import,
            content: format!("已放入稍后处理\n\nID: {}\n标题: {}", item_id, later_title),
            format: "text".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: None,
                sources: Some(vec![format!("later:{}", item_id)]),
            }),
            created_at: chrono::Utc::now(),
        })
    }

    /// 保存图片到本地
    fn save_image(
        app_data_dir: &std::path::Path,
        asset_id: &str,
        image_data: &[u8],
    ) -> Result<std::path::PathBuf> {
        let image_dir = app_data_dir.join("assistant_images");
        std::fs::create_dir_all(&image_dir)?;

        let image_path = image_dir.join(format!("{}.png", asset_id));
        std::fs::write(&image_path, image_data)?;

        Ok(image_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_import_target_parse() {
        assert!(matches!("note".parse::<ImportTarget>(), Ok(ImportTarget::Note)));
        assert!(matches!("image".parse::<ImportTarget>(), Ok(ImportTarget::Image)));
        assert!(matches!("paper".parse::<ImportTarget>(), Ok(ImportTarget::Paper)));
        assert!(matches!("later".parse::<ImportTarget>(), Ok(ImportTarget::Later)));
        assert!("unknown".parse::<ImportTarget>().is_err());
    }
}
