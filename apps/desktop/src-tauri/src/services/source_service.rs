use crate::{ccf, journal_partitions};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct SourceLookupItem {
    pub source: String,
    pub entity_type: Option<String>,
    pub name: String,
    pub url: Option<String>,
    pub publisher: Option<String>,
    pub rating: Option<String>,
    pub area: Option<String>,
    pub label: Option<String>,
    pub issn: Option<String>,
    pub eissn: Option<String>,
    pub indexes: Vec<String>,
    pub wos_categories: Vec<String>,
    pub jcr_quartile: Option<String>,
    pub jcr_category: Option<String>,
    pub jif: Option<String>,
    pub jif_rank: Option<String>,
    pub cas_quartile: Option<String>,
    pub cas_top: Option<bool>,
    pub open_access: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SourceLookupSection {
    pub key: String,
    pub title: String,
    pub items: Vec<SourceLookupItem>,
}

pub fn lookup_sources(query: &str, limit: Option<usize>) -> serde_json::Value {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return serde_json::json!({
            "query": "",
            "sections": [],
        });
    }

    let lookup_limit = limit.unwrap_or(8).max(1);
    let journal_items = journal_partitions::lookup(trimmed, lookup_limit)
        .into_iter()
        .map(|item| SourceLookupItem {
            source: "journal_partition".into(),
            entity_type: Some("journal".into()),
            name: item.title,
            url: None,
            publisher: non_empty(item.publisher),
            rating: None,
            area: None,
            label: None,
            issn: non_empty(item.issn),
            eissn: non_empty(item.eissn),
            indexes: item.indexes,
            wos_categories: item.wos_categories,
            jcr_quartile: non_empty(item.jcr_quartile),
            jcr_category: non_empty(item.jcr_category),
            jif: non_empty(item.jif),
            jif_rank: non_empty(item.jif_rank),
            cas_quartile: non_empty(item.cas_quartile),
            cas_top: Some(item.cas_top),
            open_access: Some(item.open_access),
        })
        .collect::<Vec<_>>();

    let ccf_items = ccf::lookup(trimmed, lookup_limit)
        .into_iter()
        .map(|item| SourceLookupItem {
            source: "ccf".into(),
            entity_type: non_empty(item.kind),
            name: item.full_name,
            url: non_empty(item.url),
            publisher: non_empty(item.publisher),
            rating: non_empty(item.rating),
            area: non_empty(item.area),
            label: non_empty(item.label),
            issn: None,
            eissn: None,
            indexes: Vec::new(),
            wos_categories: Vec::new(),
            jcr_quartile: None,
            jcr_category: None,
            jif: None,
            jif_rank: None,
            cas_quartile: None,
            cas_top: None,
            open_access: None,
        })
        .collect::<Vec<_>>();

    let sections = [
        SourceLookupSection {
            key: "journal_partition".into(),
            title: "期刊分区".into(),
            items: journal_items,
        },
        SourceLookupSection {
            key: "ccf".into(),
            title: "CCF 评级".into(),
            items: ccf_items,
        },
    ]
    .into_iter()
    .filter(|section| !section.items.is_empty())
    .collect::<Vec<_>>();

    serde_json::json!({
        "query": trimmed,
        "sections": sections,
    })
}

fn non_empty(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
