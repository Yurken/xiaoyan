use anyhow::{anyhow, Result};
use reqwest::{Response, StatusCode};
use serde_json::Value;
use std::error::Error;

use super::shared::{compact_preview, safe_endpoint_for_diagnostics};

fn safe_error_token(value: &str) -> Option<String> {
    let value = value.trim();
    if value.is_empty()
        || value.chars().count() > 80
        || !value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._:-".contains(character))
    {
        return None;
    }
    Some(value.to_string())
}

fn safe_upstream_error_detail(body: &str) -> Option<String> {
    let lower = body.to_ascii_lowercase();
    let category = if lower.contains("no endpoints found that support image input")
        || lower.contains("does not support image input")
        || lower.contains("image input is not supported")
    {
        Some("当前模型或路由不支持图片输入".to_string())
    } else if lower.contains("context length") || lower.contains("too many tokens") {
        Some("请求内容超过模型上下文限制".to_string())
    } else if lower.contains("rate limit") || lower.contains("too many requests") {
        Some("上游请求频率或额度受限".to_string())
    } else if lower.contains("invalid api key") || lower.contains("unauthorized") {
        Some("上游认证失败，请检查 API Key".to_string())
    } else {
        None
    };
    if category.is_some() {
        return category;
    }

    let json = serde_json::from_str::<Value>(body).ok()?;
    let candidates = [
        json.pointer("/error/type"),
        json.pointer("/error/code"),
        json.get("type"),
        json.get("code"),
    ];
    let tokens = candidates
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter_map(safe_error_token)
        .collect::<Vec<_>>();
    (!tokens.is_empty()).then(|| format!("上游错误类型：{}", tokens.join(" / ")))
}

pub(super) fn format_http_error(status: StatusCode, body: &str, label: &str) -> String {
    let detail = safe_upstream_error_detail(body)
        .map(|value| format!("，{value}"))
        .unwrap_or_default();
    format!("{}: HTTP {}{}", label, status.as_u16(), detail)
}

pub(super) fn format_openai_http_error(
    status: StatusCode,
    body: &str,
    base_url: &str,
    label: &str,
) -> String {
    let preview = compact_preview(body.trim(), 240);
    let lower = preview.to_ascii_lowercase();
    let is_html = lower.contains("<html") || lower.contains("<!doctype html");

    if is_html {
        return format!(
            "{}: HTTP {}，服务返回了 HTML 页面。请检查 base_url 是否指向 OpenAI 兼容 API 根地址（通常应以 /v1 结尾），而不是网站首页或文档页。当前 base_url: {}",
            label,
            status.as_u16(),
            safe_endpoint_for_diagnostics(base_url).trim_end_matches('/'),
        );
    }

    format_http_error(status, body, label)
}

pub(super) async fn ensure_http_success<F>(resp: Response, format_error: F) -> Result<Response>
where
    F: FnOnce(StatusCode, &str) -> String,
{
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }

    let content_length = resp.content_length();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    let text = resp.text().await?;
    crate::append_diagnostic_log(&format!(
        "[llm][http_error] status={} content_type={} content_length={:?}",
        status.as_u16(),
        content_type,
        content_length
    ));
    Err(anyhow!(format_error(status, &text)))
}

pub(super) async fn parse_json_response(resp: Response, label: &str) -> Result<Value> {
    let status = resp.status();
    let content_length = resp.content_length();
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    let bytes = resp.bytes().await.map_err(|error| {
        let error_msg = error.to_string();
        let lower = error_msg.to_ascii_lowercase();
        let mut chain = String::new();
        let mut is_timeout = lower.contains("timeout") || lower.contains("timed out");
        let mut src: Option<&dyn Error> = error.source();
        while let Some(s) = src {
            let s_msg = s.to_string();
            let s_lower = s_msg.to_ascii_lowercase();
            if !is_timeout && (s_lower.contains("timeout") || s_lower.contains("timed out")) {
                is_timeout = true;
            }
            chain.push_str(" -> ");
            chain.push_str(&s_msg);
            src = s.source();
        }
        if is_timeout {
            crate::append_diagnostic_log(&format!(
                "[llm][{}] 响应超时: status={} content_type={} content_length={:?} timeout=600s",
                label, status.as_u16(), content_type, content_length
            ));
            anyhow!("{}：响应超时（600s），模型生成耗时过长，建议缩短提示词或切换更快的模型", label)
        } else {
            crate::append_diagnostic_log(&format!(
                "[llm][{}] 读取响应体失败: status={} content_type={} content_length={:?} error={}{}",
                label, status.as_u16(), content_type, content_length, error, chain
            ));
            anyhow!("{}：读取响应失败（{}{}）", label, error, chain)
        }
    })?;
    let text = String::from_utf8_lossy(&bytes);
    serde_json::from_str::<Value>(&text).map_err(|error| {
        crate::append_diagnostic_log(&format!(
            "[llm][{}] JSON解析失败: status={} content_type={} content_length={:?} error={}",
            label,
            status.as_u16(),
            content_type,
            content_length,
            error
        ));
        if text.trim().is_empty() {
            anyhow!("{}：响应为空，无法解析为 JSON（{}）", label, error)
        } else {
            anyhow!("{}：响应不是合法 JSON（{}）", label, error)
        }
    })
}

#[cfg(test)]
mod tests {
    use super::{format_http_error, format_openai_http_error};
    use reqwest::StatusCode;

    #[test]
    fn http_errors_never_echo_prompt_or_credentials() {
        let body = r#"{"error":{"message":"echo: private prompt researcher@example.com sk-live-secret","type":"invalid_request_error","code":"bad_request"}}"#;
        let error = format_http_error(StatusCode::BAD_REQUEST, body, "LLM API error");
        assert!(error.contains("invalid_request_error"));
        assert!(!error.contains("private prompt"));
        assert!(!error.contains("researcher@example.com"));
        assert!(!error.contains("sk-live-secret"));
    }

    #[test]
    fn openai_html_error_hides_endpoint_credentials() {
        let error = format_openai_http_error(
            StatusCode::NOT_FOUND,
            "<!doctype html><html>secret response</html>",
            "https://user:password@example.com/v1?api_key=secret#token",
            "LLM API error",
        );
        assert!(error.contains("https://example.com/v1"));
        assert!(!error.contains("password"));
        assert!(!error.contains("api_key"));
        assert!(!error.contains("secret response"));
    }

    #[test]
    fn unsupported_image_error_keeps_only_an_actionable_category() {
        let body = "No endpoints found that support image input; echoed prompt: private-data";
        let error = format_http_error(StatusCode::BAD_REQUEST, body, "Vision API error");
        assert!(error.contains("不支持图片输入"));
        assert!(!error.contains("private-data"));
    }
}

pub(super) fn append_sse_chunk(buf: &mut String, bytes: &[u8]) {
    let chunk = String::from_utf8_lossy(bytes);
    if chunk.contains('\r') {
        buf.push_str(&chunk.replace('\r', ""));
    } else {
        buf.push_str(&chunk);
    }
}

pub(super) fn drain_sse_payloads(buf: &mut String) -> Vec<String> {
    let mut payloads = Vec::new();

    while let Some(pos) = buf.find("\n\n") {
        let frame = buf[..pos].to_string();
        buf.drain(..pos + 2);

        let mut data_lines = Vec::new();
        for line in frame.lines() {
            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if let Some(data) = line.strip_prefix("data:") {
                data_lines.push(data.strip_prefix(' ').unwrap_or(data).to_string());
            }
        }

        if !data_lines.is_empty() {
            payloads.push(data_lines.join("\n"));
        }
    }

    payloads
}
