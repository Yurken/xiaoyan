use anyhow::{anyhow, Result};
use serde_json::json;

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
        .map(|m| json!({ "role": m.role, "content": m.content }))
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
