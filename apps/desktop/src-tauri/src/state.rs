use sqlx::SqlitePool;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

/// Sensitive settings keys — masked as "***" in GET responses.
pub const SENSITIVE_KEYS: &[&str] = &[
    "openai_api_key",
    "anthropic_api_key",
    "openai_compatible_api_key",
    "semantic_scholar_api_key",
];

/// All settings keys exposed through the API, with their default values.
pub fn default_settings() -> HashMap<String, String> {
    let mut m = HashMap::new();
    m.insert("llm_provider".into(), "openai".into());
    m.insert("openai_api_key".into(), "".into());
    m.insert("openai_base_url".into(), "https://api.openai.com/v1".into());
    m.insert("openai_chat_model".into(), "gpt-4o-mini".into());
    m.insert("openai_embedding_model".into(), "text-embedding-3-small".into());
    m.insert("anthropic_api_key".into(), "".into());
    m.insert("anthropic_chat_model".into(), "claude-3-5-haiku-20241022".into());
    m.insert("openai_compatible_base_url".into(), "".into());
    m.insert("openai_compatible_api_key".into(), "".into());
    m.insert("openai_compatible_chat_model".into(), "deepseek-chat".into());
    m.insert("openai_compatible_embedding_model".into(), "BAAI/bge-m3".into());
    m.insert("chunk_size".into(), "800".into());
    m.insert("chunk_overlap".into(), "150".into());
    m.insert("rag_top_k".into(), "5".into());
    m.insert("semantic_scholar_api_key".into(), "".into());
    m.insert("multi_agent_enabled".into(), "true".into());
    m.insert("multi_agent_routing_mode".into(), "hybrid".into());
    m.insert(
        "multi_agent_enabled_agents".into(),
        "retrieval,planner,literature_scout,survey,paper_analyst,reproduction,synthesis".into(),
    );
    m.insert("multi_agent_max_steps".into(), "4".into());
    m.insert("multi_agent_search_limit".into(), "8".into());
    m.insert("multi_agent_supervisor_model".into(), "".into());
    m.insert("multi_agent_supervisor_temperature".into(), "0.1".into());
    m.insert("multi_agent_worker_model".into(), "".into());
    m.insert("multi_agent_worker_temperature".into(), "0.3".into());
    m.insert("multi_agent_synthesis_model".into(), "".into());
    m.insert("multi_agent_synthesis_temperature".into(), "0.4".into());
    m
}

pub struct AppState {
    pub db: SqlitePool,
    /// In-memory settings cache; loaded from DB at startup.
    pub settings: Arc<RwLock<HashMap<String, String>>>,
}

impl AppState {
    pub fn new(db: SqlitePool, settings: HashMap<String, String>) -> Self {
        Self {
            db,
            settings: Arc::new(RwLock::new(settings)),
        }
    }

    /// Read a setting value, falling back to defaults.
    pub async fn get_setting(&self, key: &str) -> String {
        let cache = self.settings.read().await;
        cache
            .get(key)
            .cloned()
            .unwrap_or_else(|| default_settings().get(key).cloned().unwrap_or_default())
    }
}
