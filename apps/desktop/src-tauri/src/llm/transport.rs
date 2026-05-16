use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT_ENCODING};
use reqwest::{Response, StatusCode};
use serde_json::Value;

use super::shared::compact_preview;

pub(super) fn identity_encoding_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT_ENCODING, HeaderValue::from_static("identity"));
    headers
}

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
    let bytes = resp.bytes().await.map_err(|error| {
        crate::append_diagnostic_log(&format!(
            "[llm][{}] 读取响应体失败: {}",
            label, error
        ));
        anyhow!("{}：读取响应失败（{}）", label, error)
    })?;
    let text = String::from_utf8_lossy(&bytes);
    serde_json::from_str::<Value>(&text).map_err(|error| {
        let preview = compact_preview(text.trim(), 800);
        crate::append_diagnostic_log(&format!(
            "[llm][{}] JSON解析失败: {} 响应预览: {}",
            label, error, preview
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
