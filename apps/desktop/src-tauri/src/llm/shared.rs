use anyhow::{anyhow, Result};
use serde_json::{json, Map, Value};

use super::LlmMessage;

pub(super) fn compact_preview(text: &str, max_chars: usize) -> String {
    text.chars()
        .take(max_chars)
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn build_message_array(messages: &[LlmMessage]) -> serde_json::Value {
    json!(messages
        .iter()
        .map(|m| build_single_message(m))
        .collect::<Vec<_>>())
}

fn build_single_message(m: &LlmMessage) -> Value {
    let mut obj = Map::new();
    obj.insert("role".into(), json!(m.role));
    if !m.images.is_empty() && m.role == "user" {
        // OpenAI 多模态：content 为数组，文本块 + image_url(data URL) 块。
        let mut parts: Vec<Value> = Vec::new();
        if !m.content.is_empty() {
            parts.push(json!({ "type": "text", "text": m.content }));
        }
        for img in &m.images {
            parts.push(json!({
                "type": "image_url",
                "image_url": { "url": format!("data:{};base64,{}", img.media_type, img.data) }
            }));
        }
        obj.insert("content".into(), json!(parts));
    } else {
        obj.insert("content".into(), json!(m.content));
    }
    if let Some(ref tci) = m.tool_call_id {
        obj.insert("tool_call_id".into(), json!(tci));
    }
    if let Some(ref tc) = m.tool_calls {
        obj.insert(
            "tool_calls".into(),
            json!(tc
                .iter()
                .map(|tc| json!({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.name,
                        "arguments": tc.arguments
                    }
                }))
                .collect::<Vec<_>>()),
        );
    }
    Value::Object(obj)
}

pub(super) fn build_anthropic_user_messages(messages: &[LlmMessage]) -> Vec<Value> {
    messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            if m.role == "tool" {
                json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": m.tool_call_id.as_deref().unwrap_or(""),
                        "content": m.content,
                    }]
                })
            } else if let Some(ref tc) = m.tool_calls {
                json!({
                    "role": "assistant",
                    "content": tc.iter().map(|tc| json!({
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": serde_json::from_str::<Value>(&tc.arguments).unwrap_or(json!({}))
                    })).collect::<Vec<_>>()
                })
            } else if !m.images.is_empty() && m.role == "user" {
                // Anthropic 多模态：image 块在前、text 块在后（与 chat_with_image 一致）。
                let mut parts: Vec<Value> = m
                    .images
                    .iter()
                    .map(|img| {
                        json!({
                            "type": "image",
                            "source": { "type": "base64", "media_type": img.media_type, "data": img.data }
                        })
                    })
                    .collect();
                if !m.content.is_empty() {
                    parts.push(json!({ "type": "text", "text": m.content }));
                }
                json!({ "role": m.role, "content": parts })
            } else {
                json!({ "role": m.role, "content": m.content })
            }
        })
        .collect()
}

pub(super) fn build_anthropic_tools(tools: &[super::ToolDefinition]) -> Value {
    json!(tools
        .iter()
        .map(|t| json!({
            "name": t.name,
            "description": t.description,
            "input_schema": t.parameters,
        }))
        .collect::<Vec<_>>())
}

fn collect_text_blocks(blocks: &[serde_json::Value]) -> String {
    blocks
        .iter()
        .filter_map(|block| block.get("text").and_then(|value| value.as_str()))
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

pub(super) fn extract_anthropic_response_text(
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
