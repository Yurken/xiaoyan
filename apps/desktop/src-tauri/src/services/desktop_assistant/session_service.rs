//! 临时桌面助手会话转正式聊天会话。
//!
//! 临时消息只存在于助手窗口内存；仅在用户明确保存后，才原子复制到既有
//! `chat_sessions` / `chat_messages`，避免形成第二套长期会话体系。

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

use super::action_service::parse_image_data_url;
use super::content_policy::{limit_text_chars, MAX_CAPTURE_TEXT_CHARS};
const MAX_PROMOTION_MESSAGES: usize = 40;
const MAX_PROMOTION_MESSAGE_CHARS: usize = 50_000;
const MAX_PROMOTION_TOTAL_CHARS: usize = 300_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantSessionPromotionInput {
    pub temporary_session_id: String,
    pub capture_session_id: String,
    pub title: Option<String>,
    pub context: String,
    pub include_capture_context: bool,
    pub research_theme_id: Option<String>,
    pub messages: Vec<AssistantSessionPromotionMessage>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantSessionPromotionMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub sources: Vec<AssistantSessionPromotionSource>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantSessionPromotionSource {
    pub source_type: String,
    pub source_id: String,
    pub title: String,
    pub url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AssistantSessionPromotionResult {
    pub conversation_id: String,
    pub already_promoted: bool,
}

pub struct AssistantSessionService;

impl AssistantSessionService {
    pub async fn promote(
        db: &SqlitePool,
        input: AssistantSessionPromotionInput,
    ) -> Result<AssistantSessionPromotionResult> {
        let session_id = normalize_id(&input.temporary_session_id, "临时会话标识")?;
        let capture_session_id = normalize_id(&input.capture_session_id, "捕获会话标识")?;

        if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM chat_sessions WHERE id = ?")
            .bind(session_id)
            .fetch_one(db)
            .await?
            > 0
        {
            return Ok(AssistantSessionPromotionResult {
                conversation_id: session_id.to_string(),
                already_promoted: true,
            });
        }

        let capture = sqlx::query(
            "SELECT source_type, source_app, window_title, created_at, user_confirmed
             FROM assistant_capture_sessions WHERE id = ?",
        )
        .bind(capture_session_id)
        .fetch_optional(db)
        .await?
        .ok_or_else(|| anyhow!("未找到对应的捕获会话"))?;
        if capture.get::<i64, _>("user_confirmed") != 1 {
            return Err(anyhow!("请先确认捕获内容"));
        }

        let context = input
            .include_capture_context
            .then(|| validate_context(&input.context))
            .transpose()?;
        let messages = validate_messages(input.messages)?;
        if !messages.iter().any(|message| message.role == "assistant") {
            return Err(anyhow!("临时会话尚无可保存的助手回答"));
        }

        let research_theme_id = normalize_optional_id(input.research_theme_id);
        if let Some(theme_id) = research_theme_id.as_deref() {
            let exists = sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM research_interests WHERE id = ?",
            )
            .bind(theme_id)
            .fetch_one(db)
            .await?;
            if exists == 0 {
                return Err(anyhow!("所选研究主题不存在或已删除"));
            }
        }

        let context_type = if research_theme_id.is_some() {
            "interest"
        } else {
            "general"
        };
        let title = promotion_title(
            input.title.as_deref(),
            &messages,
            context.as_deref().unwrap_or_default(),
        );
        let now = chrono::Utc::now();
        let mut transaction = db.begin().await?;

        sqlx::query(
            "INSERT INTO chat_sessions
             (id, title, context_type, context_id, tag, created_at, updated_at)
             VALUES (?, ?, ?, ?, '0', ?, ?)",
        )
        .bind(session_id)
        .bind(&title)
        .bind(context_type)
        .bind(&research_theme_id)
        .bind(now.to_rfc3339())
        .bind(
            (now + chrono::Duration::milliseconds(
                (messages.len() + usize::from(context.is_some())) as i64,
            ))
            .to_rfc3339(),
        )
        .execute(&mut *transaction)
        .await?;

        let source_type: String = capture.get("source_type");
        let source_app: Option<String> = capture.try_get("source_app").ok().flatten();
        let window_title: Option<String> = capture.try_get("window_title").ok().flatten();
        let captured_at: String = capture.get("created_at");
        let message_offset = if let Some(context) = context.as_deref() {
            let (context_content, images_json) = promoted_context_message(
                context,
                &source_type,
                source_app.as_deref(),
                window_title.as_deref(),
                &captured_at,
            )?;
            insert_message(
                &mut transaction,
                session_id,
                "user",
                &context_content,
                None,
                images_json.as_deref(),
                now,
            )
            .await?;
            1usize
        } else {
            0usize
        };

        for (index, message) in messages.iter().enumerate() {
            let sources_json = promotion_sources_json(&message.sources)?;
            insert_message(
                &mut transaction,
                session_id,
                &message.role,
                &message.content,
                sources_json.as_deref(),
                None,
                now + chrono::Duration::milliseconds((index + message_offset) as i64),
            )
            .await?;
        }

        transaction.commit().await?;
        Ok(AssistantSessionPromotionResult {
            conversation_id: session_id.to_string(),
            already_promoted: false,
        })
    }
}

fn normalize_id<'a>(value: &'a str, label: &str) -> Result<&'a str> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 128
        || value
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err(anyhow!("{label}无效"));
    }
    Ok(value)
}

fn normalize_optional_id(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim().to_string();
        (!value.is_empty() && value.len() <= 128).then_some(value)
    })
}

fn validate_context(context: &str) -> Result<String> {
    let context = context.trim();
    if context.is_empty() {
        return Err(anyhow!("已确认上下文不能为空"));
    }
    if context.starts_with("data:image/") {
        parse_image_data_url(context)?;
        return Ok(context.to_string());
    }
    if context.chars().count() > MAX_CAPTURE_TEXT_CHARS {
        return Err(anyhow!("已确认上下文超过 50,000 字符"));
    }
    Ok(context.to_string())
}

fn validate_messages(
    messages: Vec<AssistantSessionPromotionMessage>,
) -> Result<Vec<AssistantSessionPromotionMessage>> {
    if messages.is_empty() || messages.len() > MAX_PROMOTION_MESSAGES {
        return Err(anyhow!("临时会话消息数量无效"));
    }
    let mut total = 0usize;
    messages
        .into_iter()
        .map(|mut message| {
            if !matches!(message.role.as_str(), "user" | "assistant") {
                return Err(anyhow!("临时会话包含无效消息角色"));
            }
            message.content = message.content.trim().to_string();
            let characters = message.content.chars().count();
            if characters == 0 || characters > MAX_PROMOTION_MESSAGE_CHARS {
                return Err(anyhow!("临时会话消息内容无效或超过 50,000 字符"));
            }
            total = total.saturating_add(characters);
            if total > MAX_PROMOTION_TOTAL_CHARS {
                return Err(anyhow!("临时会话总内容超过 300,000 字符"));
            }
            if message.role == "user" {
                message.sources.clear();
            }
            Ok(message)
        })
        .collect()
}

fn promotion_title(
    requested: Option<&str>,
    messages: &[AssistantSessionPromotionMessage],
    context: &str,
) -> String {
    let base = requested
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            messages
                .iter()
                .find(|message| message.role == "user")
                .map(|message| message.content.as_str())
        })
        .unwrap_or(context);
    let base = limit_text_chars(base, 42).content;
    format!("桌面助手 · {base}")
}

fn promoted_context_message(
    context: &str,
    source_type: &str,
    source_app: Option<&str>,
    window_title: Option<&str>,
    captured_at: &str,
) -> Result<(String, Option<String>)> {
    let source_label = match source_type {
        "selection" => "选中文本",
        "clipboard" => "剪贴板",
        "screenshot" => "截图",
        "paste" => "手动粘贴",
        _ => "桌面上下文",
    };
    let mut provenance = vec![
        format!("来源：{source_label}"),
        format!("捕获时间：{captured_at}"),
    ];
    if let Some(source_app) = source_app.filter(|value| !value.trim().is_empty()) {
        provenance.push(format!("来源应用：{}", source_app.trim()));
    }
    if let Some(window_title) = window_title.filter(|value| !value.trim().is_empty()) {
        provenance.push(format!("窗口：{}", window_title.trim()));
    }

    if context.starts_with("data:image/") {
        let image = parse_image_data_url(context)?;
        let images = serde_json::to_string(&vec![serde_json::json!({
            "mediaType": image.media_type,
            "data": image.data,
        })])?;
        Ok((
            format!("[桌面助手已确认截图]\n{}", provenance.join("\n")),
            Some(images),
        ))
    } else {
        Ok((
            format!(
                "[桌面助手已确认上下文]\n{}\n\n{}",
                provenance.join("\n"),
                context
            ),
            None,
        ))
    }
}

fn promotion_sources_json(sources: &[AssistantSessionPromotionSource]) -> Result<Option<String>> {
    if sources.is_empty() {
        return Ok(None);
    }
    Ok(Some(serde_json::to_string(
        &sources
            .iter()
            .map(|source| {
                serde_json::json!({
                    "content": format!("{}:{}", source.source_type, source.source_id),
                    "source": source.title,
                    "url": source.url,
                })
            })
            .collect::<Vec<_>>(),
    )?))
}

async fn insert_message(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    session_id: &str,
    role: &str,
    content: &str,
    sources: Option<&str>,
    images: Option<&str>,
    created_at: chrono::DateTime<chrono::Utc>,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO chat_messages
         (id, session_id, role, content, sources, images, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(session_id)
    .bind(role)
    .bind(content)
    .bind(sources)
    .bind(images)
    .bind(created_at.to_rfc3339())
    .execute(&mut **transaction)
    .await?;
    Ok(())
}
