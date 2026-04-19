use std::io::Read;
use std::panic::{self, AssertUnwindSafe};
use std::path::Path;

pub fn extract_pdf_preview_text(path: &Path, max_pages: usize, max_chars: usize) -> Option<String> {
    if max_pages == 0 || max_chars == 0 {
        return None;
    }

    panic::catch_unwind(AssertUnwindSafe(|| {
        let doc = lopdf::Document::load(path).ok()?;
        let mut page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
        if page_numbers.is_empty() {
            return None;
        }
        page_numbers.sort_unstable();
        page_numbers.truncate(max_pages);

        let text = doc.extract_text(&page_numbers).ok()?;
        preview_from_text(&text, max_chars)
    }))
    .ok()
    .flatten()
}

pub fn extract_pdf_text_with_filtered_stderr(path: &Path) -> Result<String, String> {
    let mut redirect = gag::BufferRedirect::stderr().ok();
    let result = panic::catch_unwind(AssertUnwindSafe(|| pdf_extract::extract_text(path)))
        .map_err(|_| "PDF 解析异常中断".to_string())?
        .map_err(|error| error.to_string());

    if let Some(ref mut handle) = redirect {
        let mut captured = String::new();
        let _ = handle.read_to_string(&mut captured);
        for line in captured.lines() {
            if should_suppress_pdf_stderr_line(line) {
                continue;
            }
            eprintln!("{line}");
        }
    }

    match result {
        Ok(text) if !text.trim().is_empty() => Ok(text),
        Ok(_) | Err(_) => {
            if let Some(text) = extract_lopdf_full_text(path) {
                eprintln!(
                    "[pdf-extract] fell back to lopdf full text: path={}",
                    path.display()
                );
                Ok(text)
            } else {
                result
            }
        }
    }
}

pub fn preview_from_text(text: &str, max_bytes: usize) -> Option<String> {
    let preview = safe_text_preview(text, max_bytes).trim().to_string();
    if preview.is_empty() {
        None
    } else {
        Some(preview)
    }
}

fn safe_text_preview(text: &str, max_bytes: usize) -> &str {
    if text.len() <= max_bytes {
        return text;
    }
    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    &text[..end]
}

pub fn extract_lopdf_full_text(path: &Path) -> Option<String> {
    panic::catch_unwind(AssertUnwindSafe(|| {
        let doc = lopdf::Document::load(path).ok()?;
        let mut page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
        if page_numbers.is_empty() {
            return None;
        }
        page_numbers.sort_unstable();
        let text = doc.extract_text(&page_numbers).ok()?;
        let normalized = text.replace("\r\n", "\n").trim().to_string();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    }))
    .ok()
    .flatten()
    .map(|text| normalize_extracted_text(&text))
}

fn normalize_extracted_text(text: &str) -> String {
    let mut normalized_lines = Vec::new();

    for raw_line in text.replace("\r\n", "\n").replace('\r', "\n").lines() {
        let trimmed = raw_line.trim();
        if trimmed.is_empty() {
            if normalized_lines
                .last()
                .is_some_and(|line: &String| line.is_empty())
            {
                continue;
            }
            normalized_lines.push(String::new());
            continue;
        }

        if is_markdown_table_separator(trimmed) {
            continue;
        }

        let cleaned = if looks_like_sparse_markdown_table_row(trimmed) {
            collapse_markdown_table_row(trimmed)
        } else {
            normalize_inline_spacing(trimmed)
        };

        if cleaned.is_empty() {
            continue;
        }
        normalized_lines.push(cleaned);
    }

    normalized_lines.join("\n").trim().to_string()
}

fn is_markdown_table_separator(line: &str) -> bool {
    let compact = line
        .replace('|', "")
        .replace('-', "")
        .replace(':', "")
        .trim()
        .to_string();
    compact.is_empty() && line.contains("---")
}

fn looks_like_sparse_markdown_table_row(line: &str) -> bool {
    line.contains('|')
        && line
            .split('|')
            .filter(|cell| !cell.trim().is_empty())
            .count()
            >= 2
}

fn collapse_markdown_table_row(line: &str) -> String {
    line.split('|')
        .map(normalize_inline_spacing)
        .filter(|cell| !cell.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn normalize_inline_spacing(line: &str) -> String {
    let collapsed = line.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed
        .replace(",", ", ")
        .replace(".", ". ")
        .replace(";", "; ")
        .replace(":", ": ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn should_suppress_pdf_stderr_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return true;
    }
    trimmed.contains("Unicode mismatch")
}
