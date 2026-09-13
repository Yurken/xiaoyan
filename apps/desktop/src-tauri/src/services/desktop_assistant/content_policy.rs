//! Character limits shared by desktop-assistant capture, actions and imports.

pub const MAX_CAPTURE_TEXT_CHARS: usize = 50_000;
pub const MAX_INTERPRET_TEXT_CHARS: usize = 12_000;
pub const MAX_TRANSLATE_TEXT_CHARS: usize = 20_000;
pub const MAX_CHAT_CONTEXT_CHARS: usize = 16_000;
pub const MAX_NOTE_TEXT_CHARS: usize = 50_000;
pub const MAX_WINDOW_TITLE_CHARS: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LimitedText {
    pub content: String,
    pub original_chars: usize,
    pub truncated: bool,
}

pub fn limit_text_chars(content: &str, max_chars: usize) -> LimitedText {
    let original_chars = content.chars().count();
    if original_chars <= max_chars {
        return LimitedText {
            content: content.to_string(),
            original_chars,
            truncated: false,
        };
    }

    LimitedText {
        content: content.chars().take(max_chars).collect(),
        original_chars,
        truncated: true,
    }
}

pub fn retained_window_title(enabled: bool, title: Option<&str>) -> Option<String> {
    enabled.then(|| title.map(|value| limit_text_chars(value, MAX_WINDOW_TITLE_CHARS).content))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_by_unicode_characters_without_breaking_utf8() {
        let limited = limit_text_chars(&"研".repeat(12_001), 12_000);
        assert_eq!(limited.content.chars().count(), 12_000);
        assert_eq!(limited.original_chars, 12_001);
        assert!(limited.truncated);
        assert_eq!(limit_text_chars("研究", 2).content, "研究");
    }

    #[test]
    fn window_titles_are_opt_in_and_limited() {
        let title = "窗".repeat(MAX_WINDOW_TITLE_CHARS + 1);
        assert!(retained_window_title(false, Some(&title)).is_none());
        assert_eq!(
            retained_window_title(true, Some(&title))
                .unwrap()
                .chars()
                .count(),
            MAX_WINDOW_TITLE_CHARS
        );
    }
}
