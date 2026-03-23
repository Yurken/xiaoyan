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
    "planner_hint_base_url",
    "planner_hint_api_key",
    "planner_hint_temperature",
    "planner_hint_top_p",
    "planner_hint_max_tokens",
    "planner_hint_presence_penalty",
    "planner_hint_frequency_penalty",
    "planner_analysis_model",
    "planner_analysis_base_url",
    "planner_analysis_api_key",
    "planner_analysis_temperature",
    "planner_analysis_top_p",
    "planner_analysis_max_tokens",
    "planner_analysis_presence_penalty",
    "planner_analysis_frequency_penalty",
    "planner_generation_model",
    "planner_generation_base_url",
    "planner_generation_api_key",
    "planner_generation_temperature",
    "planner_generation_top_p",
    "planner_generation_max_tokens",
    "planner_generation_presence_penalty",
    "planner_generation_frequency_penalty",
    "survey_planner_model",
    "survey_planner_base_url",
    "survey_planner_api_key",
    "survey_planner_temperature",
    "survey_planner_top_p",
    "survey_planner_max_tokens",
    "survey_planner_presence_penalty",
    "survey_planner_frequency_penalty",
    "survey_writer_model",
    "survey_writer_base_url",
    "survey_writer_api_key",
    "survey_writer_temperature",
    "survey_writer_top_p",
    "survey_writer_max_tokens",
    "survey_writer_presence_penalty",
    "survey_writer_frequency_penalty",
    "paper_analysis_model",
    "paper_analysis_base_url",
    "paper_analysis_api_key",
    "paper_analysis_temperature",
    "paper_analysis_top_p",
    "paper_analysis_max_tokens",
    "paper_analysis_presence_penalty",
    "paper_analysis_frequency_penalty",
    "paper_reproduction_model",
    "paper_reproduction_base_url",
    "paper_reproduction_api_key",
    "paper_reproduction_temperature",
    "paper_reproduction_top_p",
    "paper_reproduction_max_tokens",
    "paper_reproduction_presence_penalty",
    "paper_reproduction_frequency_penalty",
    "copilot_simple_model",
    "copilot_simple_base_url",
    "copilot_simple_api_key",
    "copilot_simple_temperature",
    "copilot_simple_top_p",
    "copilot_simple_max_tokens",
    "copilot_simple_presence_penalty",
    "copilot_simple_frequency_penalty",
    "multi_agent_enabled",
    "multi_agent_routing_mode",
    "multi_agent_enabled_agents",
    "multi_agent_max_steps",
    "multi_agent_search_limit",
    "multi_agent_supervisor_model",
    "multi_agent_supervisor_base_url",
    "multi_agent_supervisor_api_key",
    "multi_agent_supervisor_temperature",
    "multi_agent_supervisor_top_p",
    "multi_agent_supervisor_max_tokens",
    "multi_agent_supervisor_presence_penalty",
    "multi_agent_supervisor_frequency_penalty",
    "multi_agent_worker_model",
    "multi_agent_worker_base_url",
    "multi_agent_worker_api_key",
    "multi_agent_worker_temperature",
    "multi_agent_worker_top_p",
    "multi_agent_worker_max_tokens",
    "multi_agent_worker_presence_penalty",
    "multi_agent_worker_frequency_penalty",
    "multi_agent_planner_model",
    "multi_agent_planner_base_url",
    "multi_agent_planner_api_key",
    "multi_agent_planner_temperature",
    "multi_agent_planner_top_p",
    "multi_agent_planner_max_tokens",
    "multi_agent_planner_presence_penalty",
    "multi_agent_planner_frequency_penalty",
    "multi_agent_literature_scout_model",
    "multi_agent_literature_scout_base_url",
    "multi_agent_literature_scout_api_key",
    "multi_agent_literature_scout_temperature",
    "multi_agent_literature_scout_top_p",
    "multi_agent_literature_scout_max_tokens",
    "multi_agent_literature_scout_presence_penalty",
    "multi_agent_literature_scout_frequency_penalty",
    "multi_agent_survey_model",
    "multi_agent_survey_base_url",
    "multi_agent_survey_api_key",
    "multi_agent_survey_temperature",
    "multi_agent_survey_top_p",
    "multi_agent_survey_max_tokens",
    "multi_agent_survey_presence_penalty",
    "multi_agent_survey_frequency_penalty",
    "multi_agent_paper_analyst_model",
    "multi_agent_paper_analyst_base_url",
    "multi_agent_paper_analyst_api_key",
    "multi_agent_paper_analyst_temperature",
    "multi_agent_paper_analyst_top_p",
    "multi_agent_paper_analyst_max_tokens",
    "multi_agent_paper_analyst_presence_penalty",
    "multi_agent_paper_analyst_frequency_penalty",
    "multi_agent_reproduction_model",
    "multi_agent_reproduction_base_url",
    "multi_agent_reproduction_api_key",
    "multi_agent_reproduction_temperature",
    "multi_agent_reproduction_top_p",
    "multi_agent_reproduction_max_tokens",
    "multi_agent_reproduction_presence_penalty",
    "multi_agent_reproduction_frequency_penalty",
    "multi_agent_synthesis_model",
    "multi_agent_synthesis_base_url",
    "multi_agent_synthesis_api_key",
    "multi_agent_synthesis_temperature",
    "multi_agent_synthesis_top_p",
    "multi_agent_synthesis_max_tokens",
    "multi_agent_synthesis_presence_penalty",
    "multi_agent_synthesis_frequency_penalty",
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
    let map = data.as_object().ok_or("请求参数格式不正确。")?;
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
        let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;
        for (key, value) in &to_save {
            sqlx::query(
                "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            )
            .bind(key)
            .bind(value)
            .bind(&now)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }
        tx.commit().await.map_err(|e| e.to_string())?;
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
