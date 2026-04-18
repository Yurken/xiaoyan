use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
struct CcfEntry {
    kind: String,
    rating: String,
    area: String,
    label: String,
    full_name: String,
    publisher: String,
    url: String,
    aliases: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CcfTag {
    pub kind: String,
    pub rating: String,
    pub area: String,
    pub label: String,
    pub full_name: String,
    pub publisher: String,
    pub url: String,
}

#[derive(Debug, Clone)]
struct CcfIndexEntry {
    entry: CcfEntry,
    aliases_words: Vec<String>,
    aliases_compact: Vec<String>,
}

static CCF_INDEX: OnceLock<Vec<CcfIndexEntry>> = OnceLock::new();

fn index() -> &'static Vec<CcfIndexEntry> {
    CCF_INDEX.get_or_init(|| {
        let raw = include_str!("data/ccf_catalog.json");
        let entries: Vec<CcfEntry> = serde_json::from_str(raw).unwrap_or_default();

        entries
            .into_iter()
            .map(|entry| {
                let mut aliases_words = Vec::new();
                let mut aliases_compact = Vec::new();

                for alias in entry
                    .aliases
                    .iter()
                    .chain(std::iter::once(&entry.label))
                    .chain(std::iter::once(&entry.full_name))
                {
                    let words = normalize_words(alias);
                    let compact = normalize_compact(alias);
                    if words.is_empty() || compact.is_empty() {
                        continue;
                    }
                    if !aliases_compact.iter().any(|item| item == &compact) {
                        aliases_words.push(words);
                        aliases_compact.push(compact);
                    }
                }

                CcfIndexEntry {
                    entry,
                    aliases_words,
                    aliases_compact,
                }
            })
            .collect()
    })
}

pub fn match_venue(venue: &str) -> Option<CcfTag> {
    scored_lookup(venue, 1).into_iter().next()
}

pub fn lookup(query: &str, limit: usize) -> Vec<CcfTag> {
    scored_lookup(query, limit.max(1))
}

pub fn infer_from_text(text: &str) -> Option<CcfTag> {
    let words = format!(" {} ", normalize_words(text));
    if words.trim().is_empty() {
        return None;
    }

    let mut best: Option<(usize, &CcfIndexEntry)> = None;

    for entry in index() {
        for (idx, alias_words) in entry.aliases_words.iter().enumerate() {
            let alias_compact = &entry.aliases_compact[idx];
            let matched = if alias_words.len() >= 12 {
                words.contains(alias_words)
            } else {
                let probe = format!(" {} ", alias_words);
                alias_compact.len() >= 4 && words.contains(&probe)
            };

            if !matched {
                continue;
            }

            let score = alias_compact.len();
            if best
                .as_ref()
                .map(|(current, _)| score > *current)
                .unwrap_or(true)
            {
                best = Some((score, entry));
            }
        }
    }

    best.map(|(_, entry)| to_tag(&entry.entry))
}

fn scored_lookup(query: &str, limit: usize) -> Vec<CcfTag> {
    let query_words = normalize_words(query);
    let query_compact = normalize_compact(query);
    if query_words.is_empty() || query_compact.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(i32, &CcfIndexEntry)> = Vec::new();

    for entry in index() {
        let mut best_score: Option<i32> = None;

        for (idx, alias_compact) in entry.aliases_compact.iter().enumerate() {
            let alias_words = &entry.aliases_words[idx];

            let score = if query_compact == *alias_compact || query_words == *alias_words {
                Some(10_000 + alias_compact.len() as i32)
            } else if alias_compact.contains(&query_compact)
                || query_compact.contains(alias_compact)
            {
                Some(7_000 + alias_compact.len() as i32)
            } else if alias_words.contains(&query_words) || query_words.contains(alias_words) {
                Some(5_000 + alias_words.len() as i32)
            } else if query_words
                .split_whitespace()
                .all(|term| alias_words.split_whitespace().any(|item| item == term))
            {
                Some(2_000 + alias_words.len() as i32)
            } else {
                None
            };

            if let Some(next_score) = score {
                best_score = Some(
                    best_score
                        .map(|value| value.max(next_score))
                        .unwrap_or(next_score),
                );
            }
        }

        if let Some(score) = best_score {
            scored.push((score, entry));
        }
    }

    scored.sort_by_key(|(score, entry)| {
        (
            Reverse(*score),
            Reverse(rating_rank(&entry.entry.rating)),
            entry.entry.full_name.as_str(),
        )
    });

    let mut dedup = Vec::new();
    for (_, entry) in scored {
        if dedup
            .iter()
            .any(|item: &CcfTag| item.full_name.eq_ignore_ascii_case(&entry.entry.full_name))
        {
            continue;
        }
        dedup.push(to_tag(&entry.entry));
        if dedup.len() >= limit {
            break;
        }
    }

    dedup
}

fn to_tag(entry: &CcfEntry) -> CcfTag {
    CcfTag {
        kind: entry.kind.clone(),
        rating: entry.rating.clone(),
        area: entry.area.clone(),
        label: entry.label.clone(),
        full_name: entry.full_name.clone(),
        publisher: entry.publisher.clone(),
        url: entry.url.clone(),
    }
}

fn normalize_words(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut last_space = true;

    for ch in input.chars() {
        let next = if ch.is_ascii_alphanumeric() {
            Some(ch.to_ascii_lowercase())
        } else {
            None
        };

        if let Some(value) = next {
            out.push(value);
            last_space = false;
        } else if !last_space {
            out.push(' ');
            last_space = true;
        }
    }

    out.trim().to_string()
}

fn normalize_compact(input: &str) -> String {
    input
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .map(|ch| ch.to_ascii_lowercase())
        .collect()
}

fn rating_rank(rating: &str) -> i32 {
    match rating {
        "A" => 3,
        "B" => 2,
        "C" => 1,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::{infer_from_text, lookup, match_venue};

    #[test]
    fn lookup_by_abbreviation_returns_expected_entry() {
        let result = lookup("CVPR", 1);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].label, "CVPR");
        assert_eq!(result[0].rating, "A");
        assert_eq!(result[0].kind, "conference");
    }

    #[test]
    fn match_full_venue_name_returns_rating() {
        let result = match_venue("IEEE Transactions on Knowledge and Data Engineering")
            .expect("expected TKDE to match");
        assert_eq!(result.label, "TKDE");
        assert_eq!(result.rating, "A");
        assert_eq!(result.kind, "journal");
    }

    #[test]
    fn infer_from_text_detects_known_venue() {
        let result = infer_from_text(
            "This paper appears in the ACM SIGMOD Conference and focuses on databases.",
        )
        .expect("expected SIGMOD to be detected");
        assert_eq!(result.label, "SIGMOD");
        assert_eq!(result.rating, "A");
    }
}
