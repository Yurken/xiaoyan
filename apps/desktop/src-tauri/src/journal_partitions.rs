use serde::{Deserialize, Serialize};
use std::cmp::Reverse;
use std::sync::OnceLock;

#[derive(Debug, Clone, Deserialize)]
struct JournalPartitionEntry {
    title: String,
    issn: String,
    eissn: String,
    publisher: String,
    indexes: Vec<String>,
    wos_categories: Vec<String>,
    jcr_quartile: String,
    jcr_category: String,
    jif: String,
    jif_rank: String,
    cas_quartile: String,
    cas_top: bool,
    open_access: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalPartitionTag {
    pub title: String,
    pub issn: String,
    pub eissn: String,
    pub publisher: String,
    pub indexes: Vec<String>,
    pub wos_categories: Vec<String>,
    pub jcr_quartile: String,
    pub jcr_category: String,
    pub jif: String,
    pub jif_rank: String,
    pub cas_quartile: String,
    pub cas_top: bool,
    pub open_access: bool,
}

#[derive(Debug, Clone)]
struct JournalPartitionIndexEntry {
    entry: JournalPartitionEntry,
    title_words: String,
    title_compact: String,
    issn_compact: String,
    eissn_compact: String,
}

static JOURNAL_PARTITIONS_INDEX: OnceLock<Vec<JournalPartitionIndexEntry>> = OnceLock::new();

fn index() -> &'static Vec<JournalPartitionIndexEntry> {
    JOURNAL_PARTITIONS_INDEX.get_or_init(|| {
        let raw = include_str!("data/journal_partitions.json");
        let entries: Vec<JournalPartitionEntry> = serde_json::from_str(raw).unwrap_or_default();

        entries
            .into_iter()
            .filter_map(|entry| {
                let title_words = normalize_words(&entry.title);
                let title_compact = normalize_compact(&entry.title);
                if title_words.is_empty() || title_compact.is_empty() {
                    return None;
                }

                Some(JournalPartitionIndexEntry {
                    issn_compact: normalize_issn(&entry.issn),
                    eissn_compact: normalize_issn(&entry.eissn),
                    entry,
                    title_words,
                    title_compact,
                })
            })
            .collect()
    })
}

pub fn match_journal(query: &str) -> Option<JournalPartitionTag> {
    scored_lookup(query, 1).into_iter().next()
}

/// Return journal titles whose wos_categories contain any of the keywords AND match the rank criterion.
/// `rank` values: "jcr_q1" | "jcr_q2" | "jcr_q3" | "cas_3" | "cas_4" | "cas_top" | "scie" | "ssci" | "ahci"
/// Results are sorted by quality (cas_quartile, jcr_quartile) and capped at `limit`.
pub fn filter_by_rank(wos_cat_keywords: &[String], rank: &str, limit: usize) -> Vec<String> {
    let kws_lower: Vec<String> = wos_cat_keywords.iter().map(|k| k.to_lowercase()).collect();

    let mut entries: Vec<&JournalPartitionIndexEntry> = index()
        .iter()
        .filter(|entry| {
            let cat_match = kws_lower.is_empty()
                || kws_lower.iter().any(|kw| {
                    entry
                        .entry
                        .wos_categories
                        .iter()
                        .any(|cat| cat.to_lowercase().contains(kw.as_str()))
                });
            if !cat_match {
                return false;
            }
            match rank {
                "jcr_q1" => entry.entry.jcr_quartile == "Q1",
                "jcr_q2" => entry.entry.jcr_quartile == "Q2",
                "jcr_q3" => entry.entry.jcr_quartile == "Q3",
                "cas_3" => entry.entry.cas_quartile == "3",
                "cas_4" => entry.entry.cas_quartile == "4",
                "cas_top" => entry.entry.cas_top,
                "scie" => entry.entry.indexes.iter().any(|i| i == "SCIE"),
                "ssci" => entry.entry.indexes.iter().any(|i| i == "SSCI"),
                "ahci" => entry.entry.indexes.iter().any(|i| i == "AHCI"),
                _ => false,
            }
        })
        .collect();

    entries.sort_by_key(|entry| {
        (
            Reverse(cas_rank(&entry.entry.cas_quartile)),
            Reverse(entry.entry.cas_top),
            Reverse(quartile_rank(&entry.entry.jcr_quartile)),
            Reverse(index_rank(&entry.entry.indexes)),
        )
    });

    entries
        .into_iter()
        .take(limit)
        .map(|entry| entry.entry.title.clone())
        .collect()
}

pub fn lookup(query: &str, limit: usize) -> Vec<JournalPartitionTag> {
    scored_lookup(query, limit.max(1))
}

fn scored_lookup(query: &str, limit: usize) -> Vec<JournalPartitionTag> {
    let query_words = normalize_words(query);
    let query_compact = normalize_compact(query);
    let query_issn = normalize_issn(query);
    if query_words.is_empty() && query_issn.is_empty() {
        return Vec::new();
    }

    let mut scored: Vec<(i32, &JournalPartitionIndexEntry)> = Vec::new();

    for entry in index() {
        let score = if !query_issn.is_empty()
            && (query_issn == entry.issn_compact || query_issn == entry.eissn_compact)
        {
            Some(12_000)
        } else if !query_compact.is_empty()
            && (query_compact == entry.title_compact || query_words == entry.title_words)
        {
            Some(10_000 + entry.title_compact.len() as i32)
        } else if !query_compact.is_empty()
            && (entry.title_compact.contains(&query_compact)
                || query_compact.contains(&entry.title_compact))
        {
            Some(7_000 + entry.title_compact.len() as i32)
        } else if !query_words.is_empty()
            && (entry.title_words.contains(&query_words)
                || query_words.contains(&entry.title_words))
        {
            Some(5_000 + entry.title_words.len() as i32)
        } else if !query_words.is_empty()
            && query_words.split_whitespace().all(|term| {
                entry
                    .title_words
                    .split_whitespace()
                    .any(|item| item == term)
            })
        {
            Some(2_000 + entry.title_words.len() as i32)
        } else {
            None
        };

        if let Some(score) = score {
            scored.push((score, entry));
        }
    }

    scored.sort_by_key(|(score, entry)| {
        (
            Reverse(*score),
            Reverse(index_rank(&entry.entry.indexes)),
            Reverse(quartile_rank(&entry.entry.jcr_quartile)),
            Reverse(cas_rank(&entry.entry.cas_quartile)),
            Reverse(entry.entry.cas_top),
            entry.entry.title.as_str(),
        )
    });

    let mut dedup = Vec::new();
    for (_, entry) in scored {
        if dedup
            .iter()
            .any(|item: &JournalPartitionTag| item.title.eq_ignore_ascii_case(&entry.entry.title))
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

fn to_tag(entry: &JournalPartitionEntry) -> JournalPartitionTag {
    JournalPartitionTag {
        title: entry.title.clone(),
        issn: entry.issn.clone(),
        eissn: entry.eissn.clone(),
        publisher: entry.publisher.clone(),
        indexes: entry.indexes.clone(),
        wos_categories: entry.wos_categories.clone(),
        jcr_quartile: entry.jcr_quartile.clone(),
        jcr_category: entry.jcr_category.clone(),
        jif: entry.jif.clone(),
        jif_rank: entry.jif_rank.clone(),
        cas_quartile: entry.cas_quartile.clone(),
        cas_top: entry.cas_top,
        open_access: entry.open_access,
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

fn normalize_issn(input: &str) -> String {
    input
        .chars()
        .filter(|ch| ch.is_ascii_digit() || matches!(ch, 'X' | 'x'))
        .map(|ch| ch.to_ascii_uppercase())
        .collect()
}

fn index_rank(indexes: &[String]) -> i32 {
    indexes
        .iter()
        .map(|index| match index.as_str() {
            "SCIE" => 4,
            "SSCI" => 3,
            "AHCI" => 2,
            "ESCI" => 1,
            _ => 0,
        })
        .max()
        .unwrap_or_default()
}

fn quartile_rank(value: &str) -> i32 {
    match value {
        "Q1" => 4,
        "Q2" => 3,
        "Q3" => 2,
        "Q4" => 1,
        _ => 0,
    }
}

fn cas_rank(value: &str) -> i32 {
    match value {
        "1" => 4,
        "2" => 3,
        "3" => 2,
        "4" => 1,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::{lookup, match_journal};

    #[test]
    fn lookup_by_title_returns_expected_partition() {
        let result = lookup("Nature Reviews Microbiology", 1);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].jcr_quartile, "Q1");
        assert_eq!(result[0].cas_quartile, "1");
        assert!(result[0].cas_top);
    }

    #[test]
    fn match_journal_by_issn_works() {
        let result = match_journal("1740-1526").expect("expected journal to match");
        assert_eq!(result.title.to_lowercase(), "nature reviews microbiology");
        assert_eq!(result.indexes, vec!["SCIE".to_string()]);
    }
}
