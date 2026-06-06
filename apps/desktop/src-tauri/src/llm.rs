use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use serde_json::json;
use std::collections::HashMap;

mod shared;
mod transport;

use self::shared::{
    build_anthropic_tools, build_anthropic_user_messages,
    build_message_array as build_message_array_impl,
    extract_anthropic_response_text as extract_anthropic_response_text_impl,
};
use self::transport::{
    append_sse_chunk, drain_sse_payloads, ensure_http_success, format_http_error,
    format_openai_http_error as format_openai_http_error_impl, parse_json_response,
};

#[derive(Clone, Debug)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
    pub tool_call_id: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Clone, Debug)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Clone, Debug)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Clone, Debug)]
pub enum StreamOutcome {
    TextCompleted(String),
    ToolCalls(Vec<ToolCall>),
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

fn stream_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}

impl LlmMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: content.into(),
            tool_call_id: None,
            tool_calls: None,
        }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: content.into(),
            tool_call_id: None,
            tool_calls: None,
        }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: content.into(),
            tool_call_id: None,
            tool_calls: None,
        }
    }
    pub fn assistant_with_tool_calls(tool_calls: Vec<ToolCall>) -> Self {
        Self {
            role: "assistant".into(),
            content: String::new(),
            tool_call_id: None,
            tool_calls: Some(tool_calls),
        }
    }
    pub fn tool(tool_call_id: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: "tool".into(),
            content: content.into(),
            tool_call_id: Some(tool_call_id.into()),
            tool_calls: None,
        }
    }
}

pub fn web_search_tool_definition() -> ToolDefinition {
    ToolDefinition {
        name: "web_search".into(),
        description: "搜索互联网获取实时信息。当需要查找最新资料、事实核查、或用户询问近期事件、新闻、当前信息时使用此工具。搜索结果包含来自网络的相关摘要和链接。".into(),
        parameters: json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索查询词，应简洁明确。建议使用关键词而非自然语言问题。"
                }
            },
            "required": ["query"]
        }),
    }
}

#[derive(Clone)]
pub enum LlmClient {
    OpenAI {
        base_url: String,
        api_key: String,
        chat_model: String,
        embed_model: String,
    },
    Anthropic {
        base_url: String,
        api_key: String,
        chat_model: String,
    },
}

const DEFAULT_ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com/v1";

fn normalize_base_url(url: &str) -> String {
    url.trim().trim_end_matches('/').to_string()
}

fn is_anthropic_compatible_base_url(base_url: &str) -> bool {
    let lower = base_url.to_ascii_lowercase();
    lower.contains("/anthropic/")
        || lower.contains("api.anthropic.com")
        || lower.contains("api.kimi.com/coding")
}

fn build_anthropic_messages_url(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    let lower = trimmed.to_ascii_lowercase();
    if lower.ends_with("/v1") || lower.contains("/v1/") {
        format!("{}/messages", trimmed)
    } else {
        format!("{}/v1/messages", trimmed)
    }
}

impl LlmClient {
    pub fn from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let provider = s
            .get("llm_provider")
            .map(|v| v.as_str())
            .unwrap_or("openai");
        match provider {
            "anthropic" => {
                let api_key = s.get("anthropic_api_key").cloned().unwrap_or_default();
                if api_key.is_empty() {
                    return Err(anyhow!("Anthropic API key not configured"));
                }
                Ok(LlmClient::Anthropic {
                    base_url: DEFAULT_ANTHROPIC_BASE_URL.to_string(),
                    api_key,
                    chat_model: s
                        .get("anthropic_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "claude-3-5-haiku-20241022".into()),
                })
            }
            "openai_compatible" => {
                let base_url = s
                    .get("openai_compatible_base_url")
                    .cloned()
                    .unwrap_or_default();
                if base_url.is_empty() {
                    return Err(anyhow!("OpenAI-compatible base URL not configured"));
                }
                let normalized_base_url = normalize_base_url(&base_url);
                let api_key = s
                    .get("openai_compatible_api_key")
                    .cloned()
                    .unwrap_or_default();
                if is_anthropic_compatible_base_url(&normalized_base_url) {
                    return Ok(LlmClient::Anthropic {
                        base_url: normalized_base_url,
                        api_key,
                        chat_model: s
                            .get("openai_compatible_chat_model")
                            .cloned()
                            .unwrap_or_else(|| "claude-3-5-haiku-20241022".into()),
                    });
                }
                Ok(LlmClient::OpenAI {
                    base_url: normalized_base_url,
                    api_key,
                    chat_model: s
                        .get("openai_compatible_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "deepseek-chat".into()),
                    embed_model: s
                        .get("openai_compatible_embedding_model")
                        .cloned()
                        .unwrap_or_else(|| "BAAI/bge-m3".into()),
                })
            }
            _ => {
                // Default: openai
                let api_key = s.get("openai_api_key").cloned().unwrap_or_default();
                if api_key.is_empty() {
                    return Err(anyhow!("OpenAI API key not configured"));
                }
                Ok(LlmClient::OpenAI {
                    base_url: s
                        .get("openai_base_url")
                        .cloned()
                        .unwrap_or_else(|| "https://api.openai.com/v1".into()),
                    api_key,
                    chat_model: s
                        .get("openai_chat_model")
                        .cloned()
                        .unwrap_or_else(|| "gpt-4o-mini".into()),
                    embed_model: s
                        .get("openai_embedding_model")
                        .cloned()
                        .unwrap_or_else(|| "text-embedding-3-small".into()),
                })
            }
        }
    }

    /// Build a client specifically for vision tasks using the "视界" (vision) model settings.
    /// Falls back to the main LLM provider if vision-specific settings are not configured.
    pub fn vision_client_from_settings(
        s: &HashMap<String, String>,
    ) -> Option<(Self, Option<String>)> {
        let model = s
            .get("vision_model")
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())?;
        let base_url = s
            .get("vision_base_url")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let api_key = s
            .get("vision_api_key")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();

        let client = if !base_url.is_empty() && !api_key.is_empty() {
            // Dedicated vision endpoint (OpenAI-compatible)
            LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model: model.clone(),
                embed_model: String::new(),
            }
        } else if !api_key.is_empty() {
            // Likely Anthropic (api_key only, no base_url)
            LlmClient::Anthropic {
                base_url: DEFAULT_ANTHROPIC_BASE_URL.to_string(),
                api_key,
                chat_model: model.clone(),
            }
        } else {
            // No dedicated key — reuse main provider with vision model override
            match Self::from_settings(s) {
                Ok(c) => c,
                Err(_) => return None,
            }
        };
        Some((client, Some(model)))
    }

    /// Build a client for embedding only.
    /// If `embedding_base_url` + `embedding_api_key` are set, use those.
    /// Otherwise fall back to the main LLM provider.
    pub fn embed_client_from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let base_url = s
            .get("embedding_base_url")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let api_key = s
            .get("embedding_api_key")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let model = s
            .get("embedding_model")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();

        if !base_url.is_empty() && !api_key.is_empty() {
            let embed_model = if model.is_empty() {
                "text-embedding-3-small".to_string()
            } else {
                model
            };
            Ok(LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model: embed_model.clone(),
                embed_model,
            })
        } else {
            Self::from_settings(s)
        }
    }

    /// Build a client specifically for literature scout tasks.
    /// Reads `multi_agent_literature_scout_base_url/api_key/model`.
    /// Falls back to the main LLM provider if scout-specific settings are not configured.
    pub fn scout_client_from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let base_url = s
            .get("multi_agent_literature_scout_base_url")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let api_key = s
            .get("multi_agent_literature_scout_api_key")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();
        let model = s
            .get("multi_agent_literature_scout_model")
            .map(|v| v.trim().to_string())
            .unwrap_or_default();

        if base_url.is_empty() || api_key.is_empty() {
            return Self::from_settings(s);
        }

        let normalized_base_url = normalize_base_url(&base_url);
        if is_anthropic_compatible_base_url(&normalized_base_url) {
            Ok(LlmClient::Anthropic {
                base_url: normalized_base_url,
                api_key,
                chat_model: if model.is_empty() {
                    "claude-3-5-haiku-20241022".into()
                } else {
                    model
                },
            })
        } else {
            Ok(LlmClient::OpenAI {
                base_url: normalized_base_url,
                api_key,
                chat_model: if model.is_empty() {
                    "deepseek-chat".into()
                } else {
                    model
                },
                embed_model: String::new(),
            })
        }
    }

    /// Vision chat — send one image + text prompt to a multimodal model.
    /// `image_b64` is the base64-encoded image bytes; `media_type` is e.g. "image/png".
    /// Fails silently (callers should handle errors) if the model doesn't support vision.
    pub async fn chat_with_image(
        &self,
        image_b64: &str,
        media_type: &str,
        text: &str,
        model: Option<&str>,
        temperature: f32,
    ) -> Result<String> {
        match self {
            LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model,
                ..
            } => {
                let client = http_client();
                let body = json!({
                    "model": model.unwrap_or(chat_model),
                    "temperature": temperature,
                    "max_tokens": 1024,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": format!("data:{media_type};base64,{image_b64}"), "detail": "low"}},
                            {"type": "text", "text": text}
                        ]
                    }]
                });
                let resp = client
                    .post(format!(
                        "{}/chat/completions",
                        base_url.trim_end_matches('/')
                    ))
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("User-Agent", USER_AGENT)
                    .json(&body)
                    .send()
                    .await?;
                let resp = ensure_http_success(resp, |status, body| {
                    format_openai_http_error_impl(status, body, base_url, "Vision API error")
                })
                .await?;
                let json = parse_json_response(resp, "Vision API error").await?;
                Ok(json["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string())
            }
            LlmClient::Anthropic {
                base_url,
                api_key,
                chat_model,
            } => {
                let client = http_client();
                let body = json!({
                    "model": model.unwrap_or(chat_model),
                    "max_tokens": 1024,
                    "temperature": temperature,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                            {"type": "text", "text": text}
                        ]
                    }]
                });
                let resp = client
                    .post(build_anthropic_messages_url(base_url))
                    .header("x-api-key", api_key)
                    .header("anthropic-version", "2023-06-01")
                    .json(&body)
                    .send()
                    .await?;
                let resp = ensure_http_success(resp, |status, body| {
                    format_http_error(status, body, "Anthropic vision error")
                })
                .await?;
                let json = parse_json_response(resp, "Anthropic vision error").await?;
                extract_anthropic_response_text_impl(&json, "Anthropic vision error")
            }
        }
    }

    /// Non-streaming chat — returns full response string.
    pub async fn chat(
        &self,
        messages: &[LlmMessage],
        model: Option<&str>,
        temperature: f32,
    ) -> Result<String> {
        self.chat_with_max_tokens(messages, model, temperature, 16_384)
            .await
    }

    pub async fn chat_with_max_tokens(
        &self,
        messages: &[LlmMessage],
        model: Option<&str>,
        temperature: f32,
        max_tokens: u32,
    ) -> Result<String> {
        match self {
            LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model,
                ..
            } => {
                openai_chat(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    max_tokens,
                )
                .await
            }
            LlmClient::Anthropic {
                base_url,
                api_key,
                chat_model,
            } => {
                anthropic_chat(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    max_tokens,
                )
                .await
            }
        }
    }

    /// Streaming chat — calls `on_delta` for each token chunk, returns full text.
    pub async fn stream_chat(
        &self,
        messages: &[LlmMessage],
        model: Option<&str>,
        temperature: f32,
        on_delta: impl Fn(String) + Send + Sync,
    ) -> Result<String> {
        match self {
            LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model,
                ..
            } => {
                stream_openai(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    16_384,
                    &on_delta,
                )
                .await
            }
            LlmClient::Anthropic {
                base_url,
                api_key,
                chat_model,
            } => {
                stream_anthropic(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    16_384,
                    &on_delta,
                )
                .await
            }
        }
    }

    /// Streaming chat with tool support — returns either text or tool calls.
    pub async fn stream_chat_with_tools(
        &self,
        messages: &[LlmMessage],
        tools: &[ToolDefinition],
        model: Option<&str>,
        temperature: f32,
        on_delta: impl Fn(String) + Send + Sync,
    ) -> Result<StreamOutcome> {
        match self {
            LlmClient::OpenAI {
                base_url,
                api_key,
                chat_model,
                ..
            } => {
                stream_openai_with_tools(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    tools,
                    temperature,
                    16_384,
                    &on_delta,
                )
                .await
            }
            LlmClient::Anthropic {
                base_url,
                api_key,
                chat_model,
            } => {
                stream_anthropic_with_tools(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    tools,
                    temperature,
                    16_384,
                    &on_delta,
                )
                .await
            }
        }
    }

    /// Generate embeddings for a batch of texts.
    pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        match self {
            LlmClient::OpenAI {
                base_url,
                api_key,
                embed_model,
                ..
            } => embed_openai(base_url, api_key, embed_model, texts).await,
            LlmClient::Anthropic { .. } => Err(anyhow!(
                "Anthropic does not support embeddings; use OpenAI-compatible endpoint"
            )),
        }
    }
}

pub fn resolve_model(settings: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find(|value| !value.is_empty())
        .map(|value| value.to_string())
}

pub fn resolve_temperature(settings: &HashMap<String, String>, key: &str, default: f32) -> f32 {
    settings
        .get(key)
        .and_then(|value| value.trim().parse::<f32>().ok())
        .unwrap_or(default)
}

pub fn resolve_temperature_chain(
    settings: &HashMap<String, String>,
    keys: &[&str],
    default: f32,
) -> f32 {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find_map(|value| value.parse::<f32>().ok())
        .unwrap_or(default)
}

pub fn resolve_max_tokens(
    settings: &HashMap<String, String>,
    keys: &[&str],
    default: u32,
) -> u32 {
    keys.iter()
        .filter_map(|key| settings.get(*key))
        .map(|value| value.trim())
        .find_map(|value| value.parse::<u32>().ok())
        .unwrap_or(default)
        .clamp(256, 32_768)
}

// ── OpenAI helpers ──────────────────────────────────────────────

const USER_AGENT: &str = "xiaoyan-desktop/0.4.0";

#[allow(dead_code)]
fn compact_preview(text: &str, max_chars: usize) -> String {
    text.chars()
        .take(max_chars)
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

#[allow(dead_code)]
fn collect_text_blocks(blocks: &[serde_json::Value]) -> String {
    blocks
        .iter()
        .filter_map(|block| block.get("text").and_then(|value| value.as_str()))
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

#[allow(dead_code)]
fn extract_anthropic_response_text(
    json: &serde_json::Value,
    label: &str,
) -> Result<String> {
    if let Some(content) = json.get("content").and_then(|value| value.as_str()) {
        let content = content.trim();
        if !content.is_empty() {
            return Ok(content.to_string());
        }
    }

    if let Some(blocks) = json.get("content").and_then(|value| value.as_array()) {
        let text = collect_text_blocks(blocks);
        if !text.is_empty() {
            return Ok(text);
        }
    }

    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        let content = content.trim();
        if !content.is_empty() {
            return Ok(content.to_string());
        }
    }

    if let Some(blocks) = json["choices"][0]["message"]["content"].as_array() {
        let text = collect_text_blocks(blocks);
        if !text.is_empty() {
            return Ok(text);
        }
    }

    let stop_reason = json
        .get("stop_reason")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown");
    let block_types = json
        .get("content")
        .and_then(|value| value.as_array())
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| block.get("type").and_then(|value| value.as_str()))
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "none".to_string());
    let preview = compact_preview(&json.to_string(), 320);

    Err(anyhow!(
        "{}: 响应中未找到可读取的文本内容。stop_reason={}, content_types={}, body={}",
        label,
        stop_reason,
        block_types,
        preview
    ))
}

#[allow(dead_code)]
fn format_openai_http_error(
    status: reqwest::StatusCode,
    body: &str,
    base_url: &str,
    label: &str,
) -> String {
    let preview = compact_preview(body.trim(), 240);
    let lower = preview.to_ascii_lowercase();
    let is_html = lower.contains("<html") || lower.contains("<!doctype html");

    if is_html {
        return format!(
            "{}: HTTP {}，服务返回了 HTML 页面。请检查 base_url 是否为 OpenAI 兼容 API 根地址（通常应以 /v1 结尾），而不是网站首页或文档页。当前 base_url: {}",
            label,
            status.as_u16(),
            base_url.trim_end_matches('/'),
        );
    }

    format!("{}: HTTP {} {}", label, status.as_u16(), preview)
}

#[allow(dead_code)]
fn build_message_array(messages: &[LlmMessage]) -> serde_json::Value {
    json!(messages
        .iter()
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect::<Vec<_>>())
}

async fn openai_chat(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
) -> Result<String> {
    let client = http_client();
    let body = json!({
        "model": model,
        "messages": build_message_array_impl(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    });
    crate::append_diagnostic_log(&format!(
        "[llm][request] url={}/chat/completions model={} temperature={} max_tokens={} messages_count={}",
        base_url.trim_end_matches('/'),
        model,
        temperature,
        max_tokens,
        messages.len(),
    ));
    let resp = client
        .post(format!(
            "{}/chat/completions",
            base_url.trim_end_matches('/')
        ))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_openai_http_error_impl(status, body, base_url, "LLM API error")
    })
    .await?;
    let json = parse_json_response(resp, "LLM API error").await?;
    Ok(json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string())
}

async fn stream_openai(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
    on_delta: &(impl Fn(String) + Send + Sync),
) -> Result<String> {
    let client = stream_http_client();
    let body = json!({
        "model": model,
        "messages": build_message_array_impl(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true,
    });
    let resp = client
        .post(format!(
            "{}/chat/completions",
            base_url.trim_end_matches('/')
        ))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_openai_http_error_impl(status, body, base_url, "LLM streaming API error")
    })
    .await?;

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();
    let mut in_think = false;

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        append_sse_chunk(&mut buf, &bytes);
        for data in drain_sse_payloads(&mut buf) {
            if data == "[DONE]" {
                if in_think {
                    full.push_str("</think>");
                    on_delta("</think>".to_string());
                }
                return Ok(full);
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                let delta = &v["choices"][0]["delta"];
                if let Some(r) = delta["reasoning_content"].as_str().or_else(|| delta["reasoning"].as_str()) {
                    if !r.is_empty() {
                        if !in_think {
                            in_think = true;
                            full.push_str("<think>");
                            on_delta("<think>".to_string());
                        }
                        full.push_str(r);
                        on_delta(r.to_string());
                    }
                }
                if let Some(c) = delta["content"].as_str() {
                    if !c.is_empty() {
                        if in_think {
                            in_think = false;
                            full.push_str("</think>");
                            on_delta("</think>".to_string());
                        }
                        full.push_str(c);
                        on_delta(c.to_string());
                    }
                }
            }
        }
    }
    if in_think {
        full.push_str("</think>");
        on_delta("</think>".to_string());
    }
    Ok(full)
}

async fn embed_openai(
    base_url: &str,
    api_key: &str,
    model: &str,
    texts: &[String],
) -> Result<Vec<Vec<f32>>> {
    let client = stream_http_client();
    let body = json!({ "model": model, "input": texts });
    let resp = client
        .post(format!("{}/embeddings", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_openai_http_error_impl(status, body, base_url, "Embedding error")
    })
    .await?;
    let json = parse_json_response(resp, "Embedding error").await?;
    let data = json["data"]
        .as_array()
        .ok_or_else(|| anyhow!("no data in embed response"))?;
    let mut result = Vec::with_capacity(data.len());
    for item in data {
        let vec = item["embedding"]
            .as_array()
            .ok_or_else(|| anyhow!("no embedding array"))?
            .iter()
            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
            .collect();
        result.push(vec);
    }
    Ok(result)
}

// ── Anthropic helpers ───────────────────────────────────────────

async fn anthropic_chat(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
) -> Result<String> {
    let client = http_client();
    let system = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());
    let user_msgs: Vec<_> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_msgs,
        "temperature": temperature,
    });
    if let Some(s) = system {
        body["system"] = json!(s);
    }
    crate::append_diagnostic_log(&format!(
        "[llm][request] url={} model={} temperature={} max_tokens={} messages_count={}",
        build_anthropic_messages_url(base_url),
        model,
        temperature,
        max_tokens,
        messages.len(),
    ));
    let resp = client
        .post(build_anthropic_messages_url(base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_http_error(status, body, "Anthropic error")
    })
    .await?;
    let json = parse_json_response(resp, "Anthropic error").await?;
    extract_anthropic_response_text_impl(&json, "Anthropic error")
}

async fn stream_anthropic(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
    on_delta: &(impl Fn(String) + Send + Sync),
) -> Result<String> {
    let client = stream_http_client();
    let system = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());
    let user_msgs: Vec<_> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();
    let mut body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_msgs,
        "temperature": temperature,
        "stream": true,
    });
    if let Some(s) = system {
        body["system"] = json!(s);
    }
    let resp = client
        .post(build_anthropic_messages_url(base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_http_error(status, body, "Anthropic streaming error")
    })
    .await?;

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();
    let mut in_think = false;

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        append_sse_chunk(&mut buf, &bytes);
        for data in drain_sse_payloads(&mut buf) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                if v["type"] == "content_block_delta" {
                    let delta = &v["delta"];
                    if let Some(t) = delta["thinking"].as_str() {
                        if !t.is_empty() {
                            if !in_think {
                                in_think = true;
                                full.push_str("<think>");
                                on_delta("<think>".to_string());
                            }
                            full.push_str(t);
                            on_delta(t.to_string());
                        }
                    }
                    if let Some(t) = delta["text"].as_str() {
                        if !t.is_empty() {
                            if in_think {
                                in_think = false;
                                full.push_str("</think>");
                                on_delta("</think>".to_string());
                            }
                            full.push_str(t);
                            on_delta(t.to_string());
                        }
                    }
                }
            }
        }
    }
    if in_think {
        full.push_str("</think>");
        on_delta("</think>".to_string());
    }
    Ok(full)
}

// ── OpenAI streaming with tools ────────────────────────────────────

async fn stream_openai_with_tools(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    tools: &[ToolDefinition],
    temperature: f32,
    max_tokens: u32,
    on_delta: &(impl Fn(String) + Send + Sync),
) -> Result<StreamOutcome> {
    let client = stream_http_client();
    let mut body = json!({
        "model": model,
        "messages": build_message_array_impl(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true,
    });
    if !tools.is_empty() {
        body["tools"] = json!(tools
            .iter()
            .map(|t| json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                }
            }))
            .collect::<Vec<_>>());
        body["tool_choice"] = json!("auto");
    }
    let resp = client
        .post(format!(
            "{}/chat/completions",
            base_url.trim_end_matches('/')
        ))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_openai_http_error_impl(status, body, base_url, "LLM streaming API error")
    })
    .await?;

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();
    let mut tool_calls_acc: Vec<serde_json::Value> = Vec::new();
    let mut in_think = false;

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        append_sse_chunk(&mut buf, &bytes);
        for data in drain_sse_payloads(&mut buf) {
            if data == "[DONE]" {
                break;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                let delta = &v["choices"][0]["delta"];
                if let Some(r) = delta["reasoning_content"].as_str().or_else(|| delta["reasoning"].as_str()) {
                    if !r.is_empty() {
                        if !in_think {
                            in_think = true;
                            full.push_str("<think>");
                            on_delta("<think>".to_string());
                        }
                        full.push_str(r);
                        on_delta(r.to_string());
                    }
                }
                if let Some(c) = delta["content"].as_str() {
                    if !c.is_empty() {
                        if in_think {
                            in_think = false;
                            full.push_str("</think>");
                            on_delta("</think>".to_string());
                        }
                        full.push_str(c);
                        on_delta(c.to_string());
                    }
                }
                if let Some(tc_array) = v["choices"][0]["delta"]["tool_calls"].as_array() {
                    for tc_delta in tc_array {
                        let index = tc_delta["index"].as_u64().unwrap_or(0) as usize;
                        while tool_calls_acc.len() <= index {
                            tool_calls_acc.push(json!({"id":"","function":{"name":"","arguments":""}}));
                        }
                        if let Some(id) = tc_delta["id"].as_str() {
                            tool_calls_acc[index]["id"] = json!(id);
                        }
                        if let Some(name) = tc_delta["function"]["name"].as_str() {
                            tool_calls_acc[index]["function"]["name"] = json!(name);
                        }
                        if let Some(args) = tc_delta["function"]["arguments"].as_str() {
                            let prev = tool_calls_acc[index]["function"]["arguments"]
                                .as_str()
                                .unwrap_or("");
                            tool_calls_acc[index]["function"]["arguments"] =
                                json!(format!("{prev}{args}"));
                        }
                    }
                }
            }
        }
    }

    if in_think {
        full.push_str("</think>");
        on_delta("</think>".to_string());
    }

    if !tool_calls_acc.is_empty() {
        let calls: Vec<ToolCall> = tool_calls_acc
            .iter()
            .filter_map(|tc| {
                Some(ToolCall {
                    id: tc["id"].as_str()?.to_string(),
                    name: tc["function"]["name"].as_str()?.to_string(),
                    arguments: tc["function"]["arguments"].as_str()?.to_string(),
                })
            })
            .collect();
        if calls.is_empty() {
            Ok(StreamOutcome::TextCompleted(full))
        } else {
            Ok(StreamOutcome::ToolCalls(calls))
        }
    } else {
        Ok(StreamOutcome::TextCompleted(full))
    }
}

// ── Anthropic streaming with tools ─────────────────────────────────

async fn stream_anthropic_with_tools(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    tools: &[ToolDefinition],
    temperature: f32,
    max_tokens: u32,
    on_delta: &(impl Fn(String) + Send + Sync),
) -> Result<StreamOutcome> {
    let client = stream_http_client();
    let system = messages
        .iter()
        .find(|m| m.role == "system")
        .map(|m| m.content.clone());
    let user_msgs = build_anthropic_user_messages(messages);
    let mut body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_msgs,
        "temperature": temperature,
        "stream": true,
    });
    if let Some(s) = system {
        body["system"] = json!(s);
    }
    if !tools.is_empty() {
        body["tools"] = build_anthropic_tools(tools);
    }
    let resp = client
        .post(build_anthropic_messages_url(base_url))
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;

    let resp = ensure_http_success(resp, |status, body| {
        format_http_error(status, body, "Anthropic streaming error")
    })
    .await?;

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();
    let mut tool_calls_acc: Vec<ToolCall> = Vec::new();
    let mut stop_reason = String::new();
    let mut in_think = false;

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        append_sse_chunk(&mut buf, &bytes);
        for data in drain_sse_payloads(&mut buf) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&data) {
                match v["type"].as_str() {
                    Some("content_block_start") => {
                        if v["content_block"]["type"].as_str() == Some("tool_use") {
                            let id = v["content_block"]["id"]
                                .as_str().unwrap_or("").to_string();
                            let name = v["content_block"]["name"]
                                .as_str().unwrap_or("").to_string();
                            tool_calls_acc.push(ToolCall {
                                id,
                                name,
                                arguments: String::new(),
                            });
                        }
                    }
                    Some("content_block_delta") => {
                        let delta = &v["delta"];
                        if delta["type"].as_str() == Some("input_json_delta") {
                            if let Some(partial) = delta["partial_json"].as_str() {
                                if let Some(last) = tool_calls_acc.last_mut() {
                                    last.arguments.push_str(partial);
                                }
                            }
                        }
                        if let Some(t) = delta["thinking"].as_str() {
                            if !t.is_empty() {
                                if !in_think {
                                    in_think = true;
                                    full.push_str("<think>");
                                    on_delta("<think>".to_string());
                                }
                                full.push_str(t);
                                on_delta(t.to_string());
                            }
                        }
                        if delta["type"].as_str() == Some("text_delta") {
                            if let Some(t) = delta["text"].as_str() {
                                if !t.is_empty() {
                                    if in_think {
                                        in_think = false;
                                        full.push_str("</think>");
                                        on_delta("</think>".to_string());
                                    }
                                    full.push_str(t);
                                    on_delta(t.to_string());
                                }
                            }
                        }
                    }
                    Some("message_delta") => {
                        if let Some(sr) = v["delta"]["stop_reason"].as_str() {
                            stop_reason = sr.to_string();
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    if in_think {
        full.push_str("</think>");
        on_delta("</think>".to_string());
    }

    if stop_reason == "tool_use" && !tool_calls_acc.is_empty() {
        Ok(StreamOutcome::ToolCalls(tool_calls_acc))
    } else {
        Ok(StreamOutcome::TextCompleted(full))
    }
}
