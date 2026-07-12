pub fn truncate_chars(text: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }

    let mut chars = text.chars();
    let truncated: String = chars.by_ref().take(max_chars).collect();
    if chars.next().is_some() {
        truncated
    } else {
        text.to_string()
    }
}

pub fn truncate_chars_with_ellipsis(text: &str, max_chars: usize) -> String {
    let truncated = truncate_chars(text, max_chars);
    if truncated.len() == text.len() {
        truncated
    } else {
        format!("{truncated}…")
    }
}

#[cfg(test)]
mod tests {
    use super::{truncate_chars, truncate_chars_with_ellipsis};

    #[test]
    fn truncate_chars_preserves_utf8_boundaries() {
        let text = "研究路径推进需要先看三篇论文";
        assert_eq!(truncate_chars(text, 4), "研究路径");
    }

    #[test]
    fn truncate_chars_with_ellipsis_marks_truncation() {
        let text = "多智能体协作";
        assert_eq!(truncate_chars_with_ellipsis(text, 4), "多智能体…");
        assert_eq!(truncate_chars_with_ellipsis(text, 20), text);
    }
}
