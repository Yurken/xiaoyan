use regex::Regex;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WikiChunk {
    pub chunk_index: usize,
    pub heading_path: String,
    pub content: String,
    pub content_hash: String,
}

pub fn content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn normalize_slug(value: &str) -> String {
    let mut out = String::new();
    let mut separator_pending = false;
    for ch in value.trim().to_lowercase().chars() {
        if ch.is_alphanumeric() || ('\u{4e00}'..='\u{9fff}').contains(&ch) {
            if separator_pending && !out.is_empty() {
                out.push('-');
            }
            separator_pending = false;
            out.push(ch);
        } else if !out.is_empty() {
            separator_pending = true;
        }
    }
    out.trim_matches('-').to_string()
}

pub fn extract_json_object(raw: &str) -> Option<&str> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    (end >= start).then_some(&raw[start..=end])
}

pub fn extract_wiki_links(content: &str) -> Vec<String> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]").unwrap());
    let mut links = re
        .captures_iter(content)
        .filter_map(|capture| capture.get(1))
        .map(|matched| normalize_slug(matched.as_str()))
        .filter(|slug| !slug.is_empty())
        .collect::<Vec<_>>();
    links.sort();
    links.dedup();
    links
}

pub fn extract_source_refs(content: &str) -> Vec<(String, String)> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| {
        Regex::new(r"\[source:(paper|note):([^\]\s]+)\]").expect("valid source ref regex")
    });
    let mut refs = re
        .captures_iter(content)
        .filter_map(|capture| {
            Some((
                capture.get(1)?.as_str().to_string(),
                capture.get(2)?.as_str().to_string(),
            ))
        })
        .collect::<Vec<_>>();
    refs.sort();
    refs.dedup();
    refs
}

pub fn query_terms(query: &str) -> Vec<String> {
    let normalized = query.to_lowercase();
    let mut terms = normalized
        .split(|ch: char| !ch.is_alphanumeric() && !('\u{4e00}'..='\u{9fff}').contains(&ch))
        .filter(|term| !term.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();

    for token in normalized.split_whitespace() {
        let cjk = token
            .chars()
            .filter(|ch| ('\u{4e00}'..='\u{9fff}').contains(ch))
            .collect::<Vec<_>>();
        if cjk.len() > 2 {
            terms.extend(cjk.windows(2).map(|pair| pair.iter().collect::<String>()));
        }
    }
    terms.retain(|term| term.chars().count() > 1 || term.chars().all(char::is_numeric));
    terms.sort();
    terms.dedup();
    terms.truncate(8);
    terms
}

pub fn lexical_score(title: &str, content: &str, terms: &[String]) -> f32 {
    if terms.is_empty() {
        return 0.0;
    }
    let title = title.to_lowercase();
    let content = content.to_lowercase();
    terms.iter().fold(0.0, |score, term| {
        let title_hits = title.matches(term).count() as f32;
        let content_hits = content.matches(term).take(8).count() as f32;
        score + title_hits * 3.0 + content_hits.min(8.0)
    }) / terms.len() as f32
}

pub fn chunk_markdown(content: &str, chunk_size: usize, overlap: usize) -> Vec<WikiChunk> {
    if content.trim().is_empty() || chunk_size == 0 {
        return Vec::new();
    }

    let mut headings: Vec<String> = Vec::new();
    let mut sections: Vec<(String, String)> = Vec::new();
    let mut current_path = String::new();
    let mut current = String::new();

    for line in content.lines() {
        let heading_level = line.chars().take_while(|ch| *ch == '#').count();
        let is_heading = heading_level > 0
            && heading_level <= 6
            && line
                .chars()
                .nth(heading_level)
                .is_some_and(char::is_whitespace);
        if is_heading {
            if !current.trim().is_empty() {
                sections.push((current_path.clone(), current.trim().to_string()));
                current.clear();
            }
            headings.truncate(heading_level.saturating_sub(1));
            headings.push(line[heading_level..].trim().to_string());
            current_path = headings.join(" > ");
        }
        current.push_str(line);
        current.push('\n');
    }
    if !current.trim().is_empty() {
        sections.push((current_path, current.trim().to_string()));
    }

    let mut chunks = Vec::new();
    for (heading_path, section) in sections {
        for chunk in crate::rag::chunk_text(&section, chunk_size, overlap) {
            let content_hash = content_hash(&chunk.content);
            chunks.push(WikiChunk {
                chunk_index: chunks.len(),
                heading_path: heading_path.clone(),
                content: chunk.content,
                content_hash,
            });
        }
    }
    chunks
}

pub fn truncate_chars(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_string();
    }
    value.chars().take(limit).collect::<String>() + "…"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_multilingual_slugs() {
        assert_eq!(normalize_slug("Graph RAG / 图谱检索"), "graph-rag-图谱检索");
    }

    #[test]
    fn extracts_links_and_source_refs() {
        let content = "参见 [[Graph RAG|图谱检索]]。证据 [source:paper:p-1]。";
        assert_eq!(extract_wiki_links(content), vec!["graph-rag"]);
        assert_eq!(
            extract_source_refs(content),
            vec![("paper".into(), "p-1".into())]
        );
    }

    #[test]
    fn markdown_chunks_keep_heading_path() {
        let chunks = chunk_markdown("# 方法\n介绍。\n## 检索\n细节。", 100, 10);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].heading_path, "方法");
        assert_eq!(chunks[1].heading_path, "方法 > 检索");
    }
}
