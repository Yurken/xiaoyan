//! 动作路由服务
//!
//! 解读、翻译、对话、导入的路由和执行

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::llm::{LlmClient, LlmMessage};

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
        session_id: &str,
        content: &str,
        question: Option<&str>,
    ) -> Result<ActionResult> {
        let system_prompt = "你是一位学术研究助手。请对以下内容进行学术解读。

解读要求：
1. **要点总结**：用 2-3 句话概括核心内容
2. **通俗解释**：用非专业人士能理解的语言解释
3. **研究关联**：如果可能，指出与学术研究的关联

请用 Markdown 格式输出，使用清晰的标题分隔各部分。";

        let user_prompt = if let Some(q) = question {
            format!("请解读以下内容，并回答问题：{}\n\n---\n\n{}", q, content)
        } else {
            format!("请解读以下内容：\n\n---\n\n{}", content)
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

        let messages = vec![
            LlmMessage::system(&system_prompt),
            LlmMessage::user(content),
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
        let system_prompt = "你是一位学术研究助手。用户会提供一段上下文内容，并基于此提出问题。

请根据上下文内容回答用户的问题。如果上下文中没有足够的信息，请如实说明。

回答要求：
1. 基于上下文内容回答
2. 引用上下文中的具体部分
3. 如果需要，可以提供额外的背景知识

请用清晰、专业的方式回答。";

        let user_prompt = format!(
            "上下文内容：\n\n---\n\n{}\n\n---\n\n我的问题：{}",
            context, question
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

    /// 执行导入动作
    pub async fn import(
        session_id: &str,
        content: &str,
        target: &str,
        metadata: Option<&str>,
    ) -> Result<ActionResult> {
        // 导入动作不需要调用 LLM，只需要记录和保存
        let result = match target {
            "note" => {
                // TODO: 调用知识笔记保存
                format!("已保存为知识笔记\n\n{}", content)
            }
            "image" => {
                // TODO: 保存截图到本地
                "截图已保存".to_string()
            }
            "paper" => {
                // TODO: 添加到论文库
                "已添加到论文库".to_string()
            }
            "later" => {
                // TODO: 放入待处理箱
                "已放入稍后处理".to_string()
            }
            _ => {
                return Err(anyhow::anyhow!("Unknown import target: {}", target));
            }
        };

        Ok(ActionResult {
            id: Uuid::new_v4().to_string(),
            session_id: session_id.to_string(),
            action: AssistantAction::Import,
            content: result,
            format: "text".to_string(),
            metadata: Some(ActionMetadata {
                model: None,
                token_usage: None,
                duration_ms: None,
                sources: None,
            }),
            created_at: chrono::Utc::now(),
        })
    }
}
