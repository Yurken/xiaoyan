#[derive(Debug, Clone)]
pub(crate) struct PaperAnalysisSlices {
    pub intro_text: String,
    pub method_text: String,
    pub experiment_text: String,
}

const DEFAULT_ANALYSIS_CHUNK_BYTES: usize = 18_000;

const METHOD_HEADINGS: &[&str] = &[
    "method",
    "methods",
    "methodology",
    "approach",
    "approaches",
    "framework",
    "proposed method",
    "proposed approach",
    "proposed framework",
    "model",
    "models",
];

const EXPERIMENT_HEADINGS: &[&str] = &[
    "experiment",
    "experiments",
    "experimental setup",
    "experimental settings",
    "results",
    "evaluation",
    "evaluations",
    "ablation",
    "ablation study",
    "performance evaluation",
];

const REFERENCE_HEADINGS: &[&str] = &[
    "references",
    "reference",
    "bibliography",
    "acknowledgements",
    "acknowledgments",
];

const KEYWORD_MARKERS: &[&str] = &[
    "author keywords",
    "keywords",
    "key words",
    "index terms",
];

const KEYWORD_STOP_HEADINGS: &[&str] = &[
    "abstract",
    "introduction",
    "1 introduction",
    "background",
    "preliminaries",
];

const NOISY_KEYWORD_PHRASES: &[&str] = &[
    "and",
    "or",
    "while",
    "such as",
    "for example",
    "e g",
    "i e",
    "via",
    "using",
    "based on",
    "respectively",
];

pub(crate) fn build_analysis_slices(full_text: &str) -> PaperAnalysisSlices {
    let cleaned = clean_analysis_text(full_text);
    let analysis_text = if cleaned.is_empty() {
        full_text.trim().to_string()
    } else {
        cleaned
    };

    if analysis_text.is_empty() {
        return PaperAnalysisSlices {
            intro_text: String::new(),
            method_text: String::new(),
            experiment_text: String::new(),
        };
    }

    let without_references = truncate_at_section(&analysis_text, REFERENCE_HEADINGS)
        .unwrap_or_else(|| analysis_text.clone());
    let working_text = if without_references.trim().is_empty() {
        analysis_text
    } else {
        without_references
    };

    let method_start = find_section_start(&working_text, METHOD_HEADINGS);
    let experiment_start = find_section_start_after(
        &working_text,
        EXPERIMENT_HEADINGS,
        method_start.unwrap_or(working_text.len() / 3),
    );

    let intro_text = method_start
        .map(|start| slice_range(&working_text, 0, start, DEFAULT_ANALYSIS_CHUNK_BYTES))
        .filter(|text| !text.trim().is_empty())
        .unwrap_or_else(|| safe_text_preview_owned(&working_text, DEFAULT_ANALYSIS_CHUNK_BYTES));

    let method_text = match method_start {
        Some(start) => {
            let end = experiment_start
                .filter(|end| *end > start)
                .unwrap_or(working_text.len());
            slice_range(&working_text, start, end, DEFAULT_ANALYSIS_CHUNK_BYTES)
        }
        None => safe_text_slice_owned(
            &working_text,
            working_text.len() / 4,
            DEFAULT_ANALYSIS_CHUNK_BYTES,
        ),
    };

    let experiment_text = match experiment_start {
        Some(start) => slice_range(
            &working_text,
            start,
            working_text.len(),
            DEFAULT_ANALYSIS_CHUNK_BYTES,
        ),
        None => safe_text_tail_owned(&working_text, DEFAULT_ANALYSIS_CHUNK_BYTES),
    };

    PaperAnalysisSlices {
        intro_text,
        method_text,
        experiment_text,
    }
}

pub(crate) fn extract_keywords_from_text(full_text: &str) -> Vec<String> {
    let search_area = safe_text_preview_owned(full_text, 6_000);
    let lower = search_area.to_ascii_lowercase();

    for marker in KEYWORD_MARKERS {
        if let Some(start) = lower.find(marker) {
            let marker_end = start + marker.len();
            let collected = collect_keyword_lines(&search_area[marker_end..]);
            let keywords = split_keyword_candidates(&collected);
            if !keywords.is_empty() {
                return keywords;
            }
        }
    }

    Vec::new()
}

fn clean_analysis_text(text: &str) -> String {
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut cleaned_lines = Vec::new();

    for line in normalized.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if cleaned_lines.last().is_some_and(|prev: &String| prev.is_empty()) {
                continue;
            }
            cleaned_lines.push(String::new());
            continue;
        }

        if should_drop_analysis_line(trimmed) {
            continue;
        }

        let compact = trimmed.split_whitespace().collect::<Vec<_>>().join(" ");
        cleaned_lines.push(compact);
    }

    cleaned_lines.join("\n").trim().to_string()
}

fn should_drop_analysis_line(line: &str) -> bool {
    let lower = line.to_ascii_lowercase();
    if lower.starts_with("![") || lower.starts_with("<img") || lower.starts_with("figure ") {
        return false;
    }
    if lower.starts_with("<!--") || lower.starts_with("page ") {
        return true;
    }
    let alpha_count = line.chars().filter(|ch| ch.is_alphabetic()).count();
    let digit_count = line.chars().filter(|ch| ch.is_ascii_digit()).count();
    if alpha_count == 0 && digit_count > 0 {
        return true;
    }
    let punctuation_only = line
        .chars()
        .all(|ch| ch.is_whitespace() || (!ch.is_alphanumeric() && !is_cjk(ch)));
    punctuation_only
}

fn truncate_at_section(text: &str, headings: &[&str]) -> Option<String> {
    let start = find_section_start(text, headings)?;
    let truncated = text[..start].trim_end().to_string();
    if truncated.is_empty() {
        None
    } else {
        Some(truncated)
    }
}

fn find_section_start(text: &str, headings: &[&str]) -> Option<usize> {
    find_section_start_after(text, headings, 0)
}

fn find_section_start_after(text: &str, headings: &[&str], min_offset: usize) -> Option<usize> {
    let mut offset = 0usize;
    for line in text.split_inclusive('\n') {
        let line_start = offset;
        offset += line.len();
        if line_start < min_offset {
            continue;
        }
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if looks_like_section_heading(trimmed, headings) {
            return Some(line_start);
        }
    }

    let tail = &text[offset.min(text.len())..];
    let trimmed = tail.trim();
    if !trimmed.is_empty() && offset >= min_offset && looks_like_section_heading(trimmed, headings) {
        Some(offset)
    } else {
        None
    }
}

fn looks_like_section_heading(line: &str, headings: &[&str]) -> bool {
    let normalized = normalize_heading(line);
    if normalized.is_empty() || normalized.len() > 80 {
        return false;
    }
    let word_count = normalized.split_whitespace().count();
    if word_count > 8 {
        return false;
    }

    headings.iter().any(|heading| {
        normalized == *heading
            || normalized.starts_with(&format!("{heading} "))
            || normalized.ends_with(&format!(" {heading}"))
    })
}

fn normalize_heading(line: &str) -> String {
    let mut trimmed = line.trim().trim_start_matches('#').trim();
    if let Some((first, rest)) = trimmed.split_once(' ') {
        let first_clean = first.trim_matches(|ch: char| !ch.is_alphanumeric());
        if !first_clean.is_empty()
            && first_clean
                .chars()
                .all(|ch| ch.is_ascii_digit() || matches!(ch, 'I' | 'V' | 'X' | 'i' | 'v' | 'x'))
        {
            trimmed = rest.trim();
        }
    }

    trimmed
        .chars()
        .map(|ch| {
            if ch.is_alphanumeric() || ch.is_whitespace() {
                ch.to_ascii_lowercase()
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn collect_keyword_lines(rest: &str) -> String {
    let mut lines = Vec::new();
    let mut started = false;

    for raw_line in rest.lines() {
        let line = raw_line
            .trim()
            .trim_start_matches(|ch: char| matches!(ch, ':' | '：' | '-' | '–' | '—'))
            .trim();

        if line.is_empty() {
            if started {
                break;
            }
            continue;
        }

        if should_stop_keyword_line(line, started) {
            break;
        }

        started = true;
        lines.push(line.to_string());

        let joined_len = lines.iter().map(|item| item.len()).sum::<usize>();
        if joined_len >= 240 || line.ends_with('.') {
            break;
        }
    }

    lines.join(" ")
}

fn should_stop_keyword_line(line: &str, started: bool) -> bool {
    let normalized_heading = normalize_heading(line);
    if KEYWORD_STOP_HEADINGS
        .iter()
        .any(|heading| normalized_heading == *heading)
    {
        return true;
    }

    if looks_like_section_heading(line, METHOD_HEADINGS)
        || looks_like_section_heading(line, EXPERIMENT_HEADINGS)
        || looks_like_section_heading(line, REFERENCE_HEADINGS)
    {
        return true;
    }

    let separator_count = line.matches(',').count()
        + line.matches(';').count()
        + line.matches('；').count()
        + line.matches('，').count()
        + line.matches('·').count()
        + line.matches('•').count();
    let word_count = line.split_whitespace().count();

    if started && separator_count == 0 && word_count > 8 {
        return true;
    }

    started && line.ends_with('.')
}

fn split_keyword_candidates(raw: &str) -> Vec<String> {
    let mut keywords: Vec<String> = Vec::new();

    for candidate in raw
        .split(|ch: char| matches!(ch, ',' | ';' | '；' | '，' | '|' | '•' | '·'))
        .map(normalize_keyword_candidate)
    {
        if let Some(keyword) = candidate {
            if keywords.iter().all(|existing| !eq_ignore_case(existing, &keyword)) {
                keywords.push(keyword);
            }
        }
    }

    keywords.truncate(8);
    keywords
}

fn normalize_keyword_candidate(candidate: &str) -> Option<String> {
    let normalized = candidate
        .trim()
        .trim_matches(|ch: char| matches!(ch, '"' | '\'' | '(' | ')' | '[' | ']' | '{' | '}' | '.' | ':' | '：'))
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if normalized.is_empty() || normalized.len() < 2 || normalized.len() > 48 {
        return None;
    }

    let lower = normalized.to_ascii_lowercase();
    if NOISY_KEYWORD_PHRASES.iter().any(|value| *value == lower) {
        return None;
    }

    let word_count = normalized.split_whitespace().count();
    if word_count > 5 {
        return None;
    }

    if lower.contains("http://") || lower.contains("https://") {
        return None;
    }

    let alpha_count = normalized.chars().filter(|ch| ch.is_alphabetic()).count();
    if alpha_count < 2 {
        return None;
    }

    let stopword_ratio = normalized
        .split_whitespace()
        .filter(|part| NOISY_KEYWORD_PHRASES.iter().any(|value| value == part))
        .count();
    if stopword_ratio > 0 && word_count <= 2 {
        return None;
    }

    Some(normalized)
}

fn eq_ignore_case(left: &str, right: &str) -> bool {
    left.eq_ignore_ascii_case(right)
}

fn safe_text_preview_owned(text: &str, max_bytes: usize) -> String {
    if text.len() <= max_bytes {
        return text.trim().to_string();
    }

    let mut end = max_bytes;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].trim().to_string()
}

fn safe_text_slice_owned(text: &str, start_bytes: usize, max_bytes: usize) -> String {
    let len = text.len();
    if start_bytes >= len {
        return safe_text_preview_owned(text, max_bytes);
    }

    let mut start = start_bytes;
    while start > 0 && !text.is_char_boundary(start) {
        start -= 1;
    }

    let raw_end = (start + max_bytes).min(len);
    let mut end = raw_end;
    while end > start && !text.is_char_boundary(end) {
        end -= 1;
    }

    text[start..end].trim().to_string()
}

fn safe_text_tail_owned(text: &str, max_bytes: usize) -> String {
    if text.len() <= max_bytes {
        return text.trim().to_string();
    }

    let mut start = text.len().saturating_sub(max_bytes);
    while start < text.len() && !text.is_char_boundary(start) {
        start += 1;
    }

    text[start..].trim().to_string()
}

fn slice_range(text: &str, start: usize, end: usize, max_bytes: usize) -> String {
    if start >= end {
        return String::new();
    }

    let span = end - start;
    let clamped = span.min(max_bytes);
    safe_text_slice_owned(text, start, clamped)
}

fn is_cjk(ch: char) -> bool {
    matches!(
        ch as u32,
        0x4E00..=0x9FFF | 0x3400..=0x4DBF | 0x20000..=0x2A6DF | 0x2A700..=0x2B73F
    )
}

#[cfg(test)]
mod tests {
    use super::{build_analysis_slices, extract_keywords_from_text};

    #[test]
    fn extracts_wrapped_keywords_without_author_noise() {
        let text = r#"Title
Author Keywords:
SocialSphere; LargeGraphLearning;
Abstract
Yajun Yang, Xin Huang, Hong Gao, Liping Jing and Qinghua
while this sentence explains the paper
"#;

        let keywords = extract_keywords_from_text(text);
        assert_eq!(keywords, vec!["SocialSphere", "LargeGraphLearning"]);
    }

    #[test]
    fn extracts_multiline_keywords_before_abstract() {
        let text = r#"Keywords:
information diffusion prediction; large-scale social networks;
sphere effect; graph learning
Abstract
This paper studies ...
"#;

        let keywords = extract_keywords_from_text(text);
        assert_eq!(
            keywords,
            vec![
                "information diffusion prediction",
                "large-scale social networks",
                "sphere effect",
                "graph learning"
            ]
        );
    }

    #[test]
    fn builds_analysis_slices_from_section_boundaries() {
        let text = r#"1 Introduction
This is the introduction.

2 Proposed Method
This is the method.

3 Experiments
This is the experiment section.

References
[1] omitted
"#;

        let slices = build_analysis_slices(text);
        assert!(slices.intro_text.contains("Introduction"));
        assert!(slices.method_text.contains("Proposed Method"));
        assert!(slices.experiment_text.contains("Experiments"));
        assert!(!slices.experiment_text.contains("References"));
    }
}
