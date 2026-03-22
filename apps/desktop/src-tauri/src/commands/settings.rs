use crate::llm::{LlmClient, LlmMessage};
use crate::state::{AppState, SENSITIVE_KEYS};
use std::collections::HashMap;
use tauri::State;

const EXPOSED_KEYS: &[&str] = &[
    "llm_provider",
    "openai_api_key",
    "openai_base_url",
    "openai_chat_model",
    "openai_embedding_model",
    "anthropic_api_key",
    "anthropic_chat_model",
    "openai_compatible_base_url",
    "openai_compatible_api_key",
    "openai_compatible_chat_model",
    "openai_compatible_embedding_model",
    "chunk_size",
    "chunk_overlap",
    "rag_top_k",
    "embedding_base_url",
    "embedding_api_key",
    "embedding_model",
    "semantic_scholar_api_key",
    "planner_hint_model",
    "planner_hint_temperature",
    "planner_analysis_model",
    "planner_analysis_temperature",
    "planner_generation_model",
    "planner_generation_temperature",
    "survey_planner_model",
    "survey_planner_temperature",
    "survey_writer_model",
    "survey_writer_temperature",
    "paper_analysis_model",
    "paper_analysis_temperature",
    "paper_reproduction_model",
    "paper_reproduction_temperature",
    "copilot_simple_model",
    "copilot_simple_temperature",
    "multi_agent_enabled",
    "multi_agent_routing_mode",
    "multi_agent_enabled_agents",
    "multi_agent_max_steps",
    "multi_agent_search_limit",
    "multi_agent_supervisor_model",
    "multi_agent_supervisor_temperature",
    "multi_agent_worker_model",
    "multi_agent_worker_temperature",
    "multi_agent_planner_model",
    "multi_agent_planner_temperature",
    "multi_agent_literature_scout_model",
    "multi_agent_literature_scout_temperature",
    "multi_agent_survey_model",
    "multi_agent_survey_temperature",
    "multi_agent_paper_analyst_model",
    "multi_agent_paper_analyst_temperature",
    "multi_agent_reproduction_model",
    "multi_agent_reproduction_temperature",
    "multi_agent_synthesis_model",
    "multi_agent_synthesis_temperature",
    "paper_visible_venue_tags",
    "paper_auto_rename_on_import",
    "paper_auto_rename_rule",
];

const MASK: &str = "***";

fn mask(key: &str, value: &str) -> String {
    if SENSITIVE_KEYS.contains(&key) && !value.is_empty() {
        MASK.to_string()
    } else {
        value.to_string()
    }
}

#[tauri::command]
pub async fn settings_get(
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let cache = state.settings.read().await;
    let defaults = crate::state::default_settings();
    let mut result = HashMap::new();
    for key in EXPOSED_KEYS {
        let val = cache
            .get(*key)
            .map(|v| v.as_str())
            .unwrap_or_else(|| defaults.get(*key).map(|v| v.as_str()).unwrap_or(""));
        result.insert(key.to_string(), mask(key, val));
    }
    Ok(result)
}

#[tauri::command]
pub async fn settings_update(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let map = data.as_object().ok_or("Expected object")?;
    let mut to_save: HashMap<String, String> = HashMap::new();

    for (key, raw) in map {
        if !EXPOSED_KEYS.contains(&key.as_str()) {
            continue;
        }
        let value = raw.as_str().unwrap_or("").trim().to_string();
        if SENSITIVE_KEYS.contains(&key.as_str()) && value == MASK {
            continue;
        }
        to_save.insert(key.clone(), value);
    }

    if !to_save.is_empty() {
        let now = chrono::Utc::now().to_rfc3339();
        for (key, value) in &to_save {
            sqlx::query(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .bind(&now)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
        }
        let mut cache = state.settings.write().await;
        for (k, v) in &to_save {
            cache.insert(k.clone(), v.clone());
        }
    }

    let updated: Vec<String> = to_save.keys().cloned().collect();
    Ok(serde_json::json!({ "ok": true, "updated": updated }))
}

// ── Test connection ──────────────────────────────────────────────

#[tauri::command]
pub async fn settings_test(
    state: State<'_, AppState>,
    data: serde_json::Value,
) -> Result<String, String> {
    // Merge submitted form values over saved settings (skip masked values)
    let saved = state.settings.read().await.clone();
    let mut merged = saved;
    if let Some(map) = data.as_object() {
        for (k, v) in map {
            let val = v.as_str().unwrap_or("").trim().to_string();
            if !val.is_empty() && val != "***" {
                merged.insert(k.clone(), val);
            }
        }
    }

    let client = LlmClient::from_settings(&merged).map_err(|e| e.to_string())?;
    let msgs = vec![LlmMessage::user("Reply with the single word: ok")];
    let reply = client.chat(&msgs, None, 0.0).await.map_err(|e| e.to_string())?;
    Ok(reply.trim().to_string())
}
