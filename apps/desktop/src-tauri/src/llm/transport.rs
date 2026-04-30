use anyhow::{anyhow, Result};
use reqwest::{Response, StatusCode};

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
    Err(anyhow!(format_error(status, &text)))
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
