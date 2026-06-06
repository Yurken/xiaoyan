use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct EvidenceLink {
    pub id: String,
    #[serde(rename = "type")]
    pub link_type: String,
    pub title: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
    pub summary: String,
}

pub struct EvidenceService;

impl EvidenceService {
    pub fn get_links(_target_id: &str, _target_type: &str) -> Result<Vec<EvidenceLink>, String> {
        // Mock returning some evidence
        Ok(vec![
            EvidenceLink {
                id: "ev_1".into(),
                link_type: "paper".into(),
                title: "Attention Is All You Need".into(),
                source_id: "paper_1".into(),
                summary: "提出了 Transformer 架构，是当前推断结论的基础。".into(),
            },
            EvidenceLink {
                id: "ev_2".into(),
                link_type: "note".into(),
                title: "实验设定草稿".into(),
                source_id: "note_2".into(),
                summary: "在笔记中规定了 batch size 为 32。".into(),
            },
        ])
    }
}
