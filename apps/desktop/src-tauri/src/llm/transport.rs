use anyhow::{anyhow, Result};
use reqwest::{Response, StatusCode};
use serde_json::Value;
use std::error::Error;

use super::shared::compact_preview;

pub(super) fn format_http_error(status: StatusCode, body: &str, label: &str) -> String {
    let preview = compact_preview(body.trim(), 240);
    if preview.is_empty() {
        format!("{}: HTTP {}", label, status.as_u16())
    } else {
        format!("{}: HTTP {} {}", label, status.as_u16(), preview)
    }
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
            base_url.trim_end_matches('/'),
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

    let text = resp.text().await?;
    crate::append_diagnostic_log(&format!(
        "[llm][http_error] status={} body_preview={}",
        status.as_u16(),
        compact_preview(&text, 800)
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
        let preview = compact_preview(text.trim(), 1200);
        crate::append_diagnostic_log(&format!(
            "[llm][{}] JSON解析失败: status={} content_type={} error={} 响应预览: {}",
            label,
            status.as_u16(),
            content_type,
            error,
            preview
        ));
        if preview.is_empty() {
            anyhow!("{}：响应为空，无法解析为 JSON（{}）", label, error)
        } else {
            anyhow!(
                "{}：响应不是合法 JSON（{}）。响应预览：{}",
                label,
                error,
                compact_preview(text.trim(), 320)
            )
        }
    })
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
