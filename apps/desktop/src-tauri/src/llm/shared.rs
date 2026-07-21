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

/// 将视觉模型的网关错误转换为可操作的中文提示；未知错误保留原文供排查。
pub(crate) fn explain_vision_error(error: &str, model: Option<&str>) -> String {
    let lower = error.to_ascii_lowercase();
    let model = model.map(str::trim).filter(|value| !value.is_empty());

    if lower.contains("no endpoints found that support image input")
        || lower.contains("does not support image input")
        || lower.contains("image input is not supported")
    {
        let target = model
            .map(|value| format!("视觉模型「{}」", value))
            .unwrap_or_else(|| "当前使用的模型".to_string());
        return format!(
            "{}不支持图片输入。请前往「设置 → 模型角色 → 视界·视觉」更换多模态模型，并通过连接测试后重试。",
            target
        );
    }

    if lower.contains("html") || lower.contains("<html") || lower.contains("<!doctype") {
        return "接口地址返回了网页而不是 API。请检查视觉模型接口地址是否正确，通常需要以 /v1 结尾。"
            .to_string();
    }

    if lower.contains("401") || lower.contains("unauthorized") || lower.contains("invalid api key")
    {
        return "视觉模型的 API Key 无效或没有权限。请在设置中检查密钥。".to_string();
    }

    if lower.contains("403") || lower.contains("forbidden") {
        return "当前账号没有权限访问该视觉模型。请检查密钥权限或更换模型。".to_string();
    }

    if lower.contains("model") && (lower.contains("not exist") || lower.contains("not found")) {
        return model
            .map(|value| format!("视觉模型「{}」不存在。请检查模型名称。", value))
            .unwrap_or_else(|| "视觉模型不存在。请检查模型名称。".to_string());
    }

    if lower.contains("404") || lower.contains("not found") {
        return "视觉模型的接口地址或模型名称不存在。请检查设置。".to_string();
    }

    if lower.contains("timeout") || lower.contains("timed out") {
        return "图片解读请求超时。请检查网络或稍后重试。".to_string();
    }

    if lower.contains("connection refused")
        || lower.contains("dns error")
        || lower.contains("could not connect")
    {
        return "无法连接视觉模型接口。请检查网络和接口地址。".to_string();
    }

    error.trim().to_string()
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

#[cfg(test)]
mod tests {
    use super::explain_vision_error;

    #[test]
    fn explains_unsupported_image_input_with_next_step() {
        let error = r#"LLM streaming API error: HTTP 404 {"error":{"message":"No endpoints found that support image input"}}"#;
        let message = explain_vision_error(error, Some("text-only-model"));

        assert!(message.contains("不支持图片输入"));
        assert!(message.contains("视界·视觉"));
        assert!(message.contains("text-only-model"));
    }

    #[test]
    fn keeps_unknown_vision_errors_for_diagnostics() {
        assert_eq!(
            explain_vision_error("unexpected upstream failure", None),
            "unexpected upstream failure"
        );
    }
}
