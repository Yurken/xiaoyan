use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use serde_json::json;
use std::collections::HashMap;

#[derive(Clone, Debug)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

impl LlmMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system".into(), content: content.into() }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: "user".into(), content: content.into() }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: "assistant".into(), content: content.into() }
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
        api_key: String,
        chat_model: String,
    },
}

impl LlmClient {
    pub fn from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let provider = s.get("llm_provider").map(|v| v.as_str()).unwrap_or("openai");
        match provider {
            "anthropic" => {
                let api_key = s.get("anthropic_api_key").cloned().unwrap_or_default();
                if api_key.is_empty() {
                    return Err(anyhow!("Anthropic API key not configured"));
                }
                Ok(LlmClient::Anthropic {
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
                let api_key = s
                    .get("openai_compatible_api_key")
                    .cloned()
                    .unwrap_or_default();
                Ok(LlmClient::OpenAI {
                    base_url,
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

    /// Build a client for embedding only.
    /// If `embedding_base_url` + `embedding_api_key` are set, use those.
    /// Otherwise fall back to the main LLM provider.
    pub fn embed_client_from_settings(s: &HashMap<String, String>) -> Result<Self> {
        let base_url = s.get("embedding_base_url").map(|v| v.trim().to_string()).unwrap_or_default();
        let api_key = s.get("embedding_api_key").map(|v| v.trim().to_string()).unwrap_or_default();
        let model = s.get("embedding_model").map(|v| v.trim().to_string()).unwrap_or_default();

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

    pub fn model_for_role(&self, role_key: &str, s: &HashMap<String, String>) -> String {
        if let Some(m) = s.get(role_key) {
            if !m.is_empty() {
                return m.clone();
            }
        }
        self.default_model()
    }

    pub fn default_model(&self) -> String {
        match self {
            LlmClient::OpenAI { chat_model, .. } => chat_model.clone(),
            LlmClient::Anthropic { chat_model, .. } => chat_model.clone(),
        }
    }

    /// Non-streaming chat — returns full response string.
    pub async fn chat(
        &self,
        messages: &[LlmMessage],
        model: Option<&str>,
        temperature: f32,
    ) -> Result<String> {
        match self {
            LlmClient::OpenAI { base_url, api_key, chat_model, .. } => {
                openai_chat(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    4096,
                )
                .await
            }
            LlmClient::Anthropic { api_key, chat_model } => {
                anthropic_chat(
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    4096,
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
            LlmClient::OpenAI { base_url, api_key, chat_model, .. } => {
                stream_openai(
                    base_url,
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    4096,
                    &on_delta,
                )
                .await
            }
            LlmClient::Anthropic { api_key, chat_model } => {
                stream_anthropic(
                    api_key,
                    model.unwrap_or(chat_model),
                    messages,
                    temperature,
                    4096,
                    &on_delta,
                )
                .await
            }
        }
    }

    /// Generate embeddings for a batch of texts.
    pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        match self {
            LlmClient::OpenAI { base_url, api_key, embed_model, .. } => {
                embed_openai(base_url, api_key, embed_model, texts).await
            }
            LlmClient::Anthropic { .. } => {
                Err(anyhow!("Anthropic does not support embeddings; use OpenAI-compatible endpoint"))
            }
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

// ── OpenAI helpers ──────────────────────────────────────────────

const USER_AGENT: &str = "claude-code/1.0";

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
    let client = reqwest::Client::new();
    let body = json!({
        "model": model,
        "messages": build_message_array(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    });
    let resp = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(anyhow!("OpenAI error: {}", text));
    }
    let json: serde_json::Value = resp.json().await?;
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
    let client = reqwest::Client::new();
    let body = json!({
        "model": model,
        "messages": build_message_array(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true,
    });
    let resp = client
        .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(anyhow!("OpenAI streaming error: {}", text));
    }

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        loop {
            if let Some(pos) = buf.find('\n') {
                let line = buf[..pos].trim().to_string();
                buf = buf[pos + 1..].to_string();
                if let Some(data) = line.strip_prefix("data: ") {
                    if data == "[DONE]" {
                        return Ok(full);
                    }
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                        if let Some(c) = v["choices"][0]["delta"]["content"].as_str() {
                            if !c.is_empty() {
                                full.push_str(c);
                                on_delta(c.to_string());
                            }
                        }
                    }
                }
            } else {
                break;
            }
        }
    }
    Ok(full)
}

async fn embed_openai(
    base_url: &str,
    api_key: &str,
    model: &str,
    texts: &[String],
) -> Result<Vec<Vec<f32>>> {
    let client = reqwest::Client::new();
    let body = json!({ "model": model, "input": texts });
    let resp = client
        .post(format!("{}/embeddings", base_url.trim_end_matches('/')))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(anyhow!("Embedding error: {}", text));
    }
    let json: serde_json::Value = resp.json().await?;
    let data = json["data"].as_array().ok_or_else(|| anyhow!("no data in embed response"))?;
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
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
) -> Result<String> {
    let client = reqwest::Client::new();
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
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(anyhow!("Anthropic error: {}", text));
    }
    let json: serde_json::Value = resp.json().await?;
    Ok(json["content"][0]["text"].as_str().unwrap_or("").to_string())
}

async fn stream_anthropic(
    api_key: &str,
    model: &str,
    messages: &[LlmMessage],
    temperature: f32,
    max_tokens: u32,
    on_delta: &(impl Fn(String) + Send + Sync),
) -> Result<String> {
    let client = reqwest::Client::new();
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
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let text = resp.text().await?;
        return Err(anyhow!("Anthropic streaming error: {}", text));
    }

    let mut full = String::new();
    let mut buf = String::new();
    let mut stream = resp.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        loop {
            if let Some(pos) = buf.find('\n') {
                let line = buf[..pos].trim().to_string();
                buf = buf[pos + 1..].to_string();
                if let Some(data) = line.strip_prefix("data: ") {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                        if v["type"] == "content_block_delta" {
                            if let Some(t) = v["delta"]["text"].as_str() {
                                if !t.is_empty() {
                                    full.push_str(t);
                                    on_delta(t.to_string());
                                }
                            }
                        }
                    }
                }
            } else {
                break;
            }
        }
    }
    Ok(full)
}
