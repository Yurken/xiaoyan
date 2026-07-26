//! 动作路由服务
//!
//! 解读、翻译、对话、导入的路由和执行
//! 所有落库逻辑统一在此层完成，command 层只做参数校验和调用

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::permission_service::PermissionService;
use crate::llm::{LlmClient, LlmImage, LlmMessage};
use base64::Engine;

const MAX_ASSISTANT_TEXT_CHARS: usize = 50_000;
const MAX_ASSISTANT_IMAGE_BYTES: usize = 20 * 1024 * 1024;

enum ActionInput {
    Text(String),
    Image(LlmImage),
}

pub(super) fn parse_image_data_url(content: &str) -> Result<LlmImage> {
    let (header, data) = content
        .split_once(',')
        .ok_or_else(|| anyhow!("图片数据格式无效"))?;
    let media_type = header
        .strip_prefix("data:")
        .and_then(|value| value.strip_suffix(";base64"))
        .ok_or_else(|| anyhow!("图片必须使用 base64 data URL"))?;
    if !matches!(
        media_type,
        "image/png" | "image/jpeg" | "image/webp" | "image/gif"
    ) {
        return Err(anyhow!("不支持的图片格式: {}", media_type));
    }
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|_| anyhow!("图片 base64 数据无效"))?;
    if decoded.is_empty() || decoded.len() > MAX_ASSISTANT_IMAGE_BYTES {
        return Err(anyhow!("图片为空或超过 20 MB 限制"));
    }
    Ok(LlmImage {
        media_type: media_type.to_string(),
        data: data.to_string(),
    })
}

fn parse_action_input(content: &str) -> Result<ActionInput> {
    if content.starts_with("data:image/") {
        return parse_image_data_url(content).map(ActionInput::Image);
    }
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("内容不能为空"));
    }
    if trimmed.chars().count() > MAX_ASSISTANT_TEXT_CHARS {
        return Err(anyhow!("内容超过 50000 字符，请缩小选区后重试"));
    }
    let privacy = PermissionService::check_privacy(None, None, Some(trimmed), &[]);
    if !privacy.allowed {
        return Err(anyhow!(privacy
            .reason
            .unwrap_or_else(|| "内容被隐私策略阻止".to_string())));
    }
    Ok(ActionInput::Text(PermissionService::sanitize_content(
        trimmed,
    )))
}

/// 助手动作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssistantAction {
    Interpret,
    Translate,
    Chat,
    Import,
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
        model: Option<&str>,
        session_id: &str,
        content: &str,
        question: Option<&str>,
    ) -> Result<ActionResult> {
        let input = parse_action_input(content)?;

        let system_prompt = "你是一位学术研究助手。请对以下内容进行学术解读。

解读要求：
1. **要点总结**：用 2-3 句话概括核心内容
2. **通俗解释**：用非专业人士能理解的语言解释
3. **研究关联**：如果可能，指出与学术研究的关联

请用 Markdown 格式输出，使用清晰的标题分隔各部分。";

        let question = question.map(str::trim).filter(|value| !value.is_empty());
        let user_message = match input {
            ActionInput::Text(sanitized_content) => {
                let prompt = if let Some(q) = question {
                    format!(
                        "请解读以下内容，并回答问题：{}\n\n---\n\n{}",
                        q, sanitized_content
                    )
                } else {
                    format!("请解读以下内容：\n\n---\n\n{}", sanitized_content)
                };
                LlmMessage::user(prompt)
            }
            ActionInput::Image(image) => {
                let prompt = question
                    .map(|q| format!("请解读这张用户主动截取的图片，并回答：{}。识别可能有误时请明确提示。", q))
                    .unwrap_or_else(|| "请解读这张用户主动截取的图片，提取要点并说明研究关联。识别可能有误时请明确提示。".to_string());
                LlmMessage::user_with_images(prompt, vec![image])
            }
        };

        let messages = vec![LlmMessage::system(system_prompt), user_message];

        let start = std::time::Instant::now();
        let result = llm.stream_chat(&messages, model, 0.7, |_| {}).await?;
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
        model: Option<&str>,
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

        let user_message = match parse_action_input(content)? {
            ActionInput::Text(sanitized_content) => LlmMessage::user(sanitized_content),
            ActionInput::Image(image) => LlmMessage::user_with_images(
                format!(
                    "请先识别图片中的文字，再翻译成{}。请明确提示 OCR 识别可能有误。",
                    lang
                ),
                vec![image],
            ),
        };
        let messages = vec![LlmMessage::system(&system_prompt), user_message];

        let start = std::time::Instant::now();
        let result = llm.stream_chat(&messages, model, 0.3, |_| {}).await?;
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
        model: Option<&str>,
        session_id: &str,
        context: &str,
        question: &str,
    ) -> Result<ActionResult> {
        let input = parse_action_input(context)?;
        let question = question.trim();
        if question.is_empty() {
            return Err(anyhow!("请输入问题"));
        }

        let system_prompt = "你是一位学术研究助手。用户会提供一段上下文内容，并基于此提出问题。

请根据上下文内容回答用户的问题。如果上下文中没有足够的信息，请如实说明。

回答要求：
1. 基于上下文内容回答
2. 引用上下文中的具体部分
3. 如果需要，可以提供额外的背景知识

请用清晰、专业的方式回答。";

        let user_message = match input {
            ActionInput::Text(sanitized_context) => LlmMessage::user(format!(
                "上下文内容：\n\n---\n\n{}\n\n---\n\n我的问题：{}",
                sanitized_context, question
            )),
            ActionInput::Image(image) => LlmMessage::user_with_images(
                format!(
                    "请结合这张用户主动截取的图片回答问题：{}。识别可能有误时请明确提示。",
                    question
                ),
                vec![image],
            ),
        };

        let messages = vec![LlmMessage::system(system_prompt), user_message];

        let start = std::time::Instant::now();
        let result = llm.stream_chat(&messages, model, 0.7, |_| {}).await?;
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

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_input_rejects_empty_and_oversized_content() {
        assert!(parse_action_input("   ").is_err());
        assert!(parse_action_input(&"x".repeat(MAX_ASSISTANT_TEXT_CHARS + 1)).is_err());
    }

    #[test]
    fn image_data_url_is_validated() {
        assert!(parse_image_data_url("data:text/plain;base64,SGVsbG8=").is_err());
        assert!(parse_image_data_url("data:image/png;base64,not-base64").is_err());
        assert!(parse_image_data_url("data:image/png;base64,iVBORw0KGgo=").is_ok());
    }
}
