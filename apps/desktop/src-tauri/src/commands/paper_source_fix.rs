use std::collections::HashMap;

use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};

const SOURCE_FIX_SYSTEM_PROMPT: &str = r#"你是论文源文本修复助手。你的任务是对同一篇论文的两份机器提取结果进行互相印证：
- `source.md`：更接近 Markdown/版面结构，但可能有伪表格、顺序错乱、单词黏连。
- `source.txt`：更接近纯文本，但可能丢失层级、标题和列表结构。

请综合两份输入，输出一份更适合后续大模型分析的 `source_fix.md`。

要求：
1. 只输出 Markdown 正文，不要解释，不要加代码块。
2. 保留论文标题、作者、摘要、章节标题、正文、列表、公式附近的自然段结构。
3. 优先修复明显的伪表格、阅读顺序错误和单词黏连。
4. 不要凭空编造论文中不存在的内容；无法确认时宁可保留原文。
5. 如果两份文本冲突，优先选择语义更完整、语言更通顺的一版。
"#;

const SOURCE_FIX_PROMPT: &str = r#"请基于下面两份从同一篇 PDF 提取的结果，交叉校对并输出一份修复后的 `source_fix.md`。

论文文件名：{file_name}

`source.md`
---
{source_md}
---

`source.txt`
---
{source_txt}
---
"#;

pub(crate) async fn generate_fixed_source_markdown(
    settings: &HashMap<String, String>,
    file_name: &str,
    source_md: &str,
    source_txt: &str,
) -> Option<String> {
    if source_md.trim().is_empty() || source_txt.trim().is_empty() {
        return None;
    }

    let client = LlmClient::from_settings(settings).ok()?;
    let model = resolve_model(
        settings,
        &[
            "paper_source_fix_model",
            "paper_analysis_model",
            "planner_hint_model",
        ],
    );
    let temperature = resolve_temperature(settings, "paper_source_fix_temperature", 0.1);
    let prompt = SOURCE_FIX_PROMPT
        .replace("{file_name}", file_name)
        .replace("{source_md}", &clip_for_fix_prompt(source_md))
        .replace("{source_txt}", &clip_for_fix_prompt(source_txt));
    let messages = vec![
        LlmMessage::system(SOURCE_FIX_SYSTEM_PROMPT),
        LlmMessage::user(prompt),
    ];
    let response = client.chat(&messages, model.as_deref(), temperature).await.ok()?;
    let normalized = normalize_fixed_markdown(&response);
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn clip_for_fix_prompt(text: &str) -> String {
    const WINDOW: usize = 16_000;
    if text.len() <= WINDOW * 3 {
        return text.trim().to_string();
    }

    let head = safe_slice(text, 0, WINDOW);
    let middle_start = (text.len() / 2).saturating_sub(WINDOW / 2);
    let middle = safe_slice(text, middle_start, WINDOW);
    let tail_start = text.len().saturating_sub(WINDOW);
    let tail = safe_slice(text, tail_start, WINDOW);
    format!("{head}\n\n[... middle ...]\n\n{middle}\n\n[... tail ...]\n\n{tail}")
}

fn normalize_fixed_markdown(text: &str) -> String {
    let trimmed = text.trim().trim_matches('`').trim();
    let without_fence = if trimmed.starts_with("markdown\n") {
        trimmed.trim_start_matches("markdown\n")
    } else {
        trimmed
    };
    without_fence.replace("\r\n", "\n").trim().to_string()
}

fn safe_slice(text: &str, start_bytes: usize, max_bytes: usize) -> String {
    if text.is_empty() {
        return String::new();
    }

    let mut start = start_bytes.min(text.len());
    while start > 0 && !text.is_char_boundary(start) {
        start -= 1;
    }
    let mut end = (start + max_bytes).min(text.len());
    while end > start && !text.is_char_boundary(end) {
        end -= 1;
    }
    text[start..end].trim().to_string()
}
