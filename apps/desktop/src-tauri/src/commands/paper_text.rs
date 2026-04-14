use std::io::Read;
use std::path::Path;

pub fn extract_pdf_preview_text(path: &Path, max_pages: usize, max_chars: usize) -> Option<String> {
    if max_pages == 0 || max_chars == 0 {
        return None;
    }

    let doc = lopdf::Document::load(path).ok()?;
    let mut page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
    if page_numbers.is_empty() {
        return None;
    }
    page_numbers.sort_unstable();
    page_numbers.truncate(max_pages);

    let text = doc.extract_text(&page_numbers).ok()?;
    let preview = safe_text_preview(&text, max_chars).trim().to_string();
    if preview.is_empty() {
        None
    } else {
        Some(preview)
    }
}

pub fn extract_pdf_text_with_filtered_stderr(path: &Path) -> Result<String, String> {
    let mut redirect = gag::BufferRedirect::stderr().ok();
    let result = pdf_extract::extract_text(path).map_err(|e| e.to_string());

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

    result
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

fn should_suppress_pdf_stderr_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return true;
    }
    trimmed.contains("Unicode mismatch")
}
