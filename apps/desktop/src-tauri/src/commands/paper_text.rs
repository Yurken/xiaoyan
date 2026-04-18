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

pub fn extract_pdf_text_with_filtered_stderr(
    app: &tauri::AppHandle,
    path: &Path,
) -> Result<String, String> {
    match crate::markitdown_runtime::extract_pdf_text(app, path) {
        Ok(text) => Ok(text),
        Err(markitdown_error) => {
            if let Some(text) = extract_pdf_full_text(path) {
                eprintln!(
                    "[pdf-extract] markitdown unavailable, fell back to lopdf: path={} error={}",
                    path.display(),
                    markitdown_error
                );
                Ok(text)
            } else {
                Err(markitdown_error)
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

fn extract_pdf_full_text(path: &Path) -> Option<String> {
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
}
