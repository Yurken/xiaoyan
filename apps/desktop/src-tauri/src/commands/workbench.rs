use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::repositories::settings_repository::upsert_settings;
use crate::state::AppState;
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::{Emitter, State};
use uuid::Uuid;

const WORKBENCH_OVERVIEW_CACHE_KEY: &str = "workbench_overview_text_cache";

const WORKBENCH_OVERVIEW_SYSTEM: &str = r#"你是研究助手"小妍"，负责为研究者生成工作台首页的动态概览文案。

你的输出必须是严格的 JSON：
{
  "hero_title": "一句话标题（≤25字），点明最值得关注的研究推进方向",
  "hero_description": "一段话（≤80字），概括研究状态、待推进事项和风险",
  "summary_items": [
    { "title": "摘要标题（≤15字）", "description": "简短描述（≤30字）" }
  ]
}

要求：
- 语气温和、克制，用"你"称呼研究者
- hero_title 要有行动感，让研究者知道下一步该做什么（如"准备投稿CVPR"、"继续文献调研"）
- hero_description 要具体提到数据中的数字和状态，不要泛泛而谈
- summary_items 2-3 条，分别覆盖不同的工作维度（如投稿/实验/文献/写作），不要重复
- 如果某项数据为空或不存在，诚实说明而不是编造
- 只输出 JSON，不要包含其他文字或 Markdown 标记"#;

fn string_field(value: &Value, camel_key: &str, snake_key: &str) -> String {
    value
        .get(camel_key)
        .or_else(|| value.get(snake_key))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_default()
}

fn normalize_overview_text(value: &Value) -> Value {
    let hero_title = string_field(value, "heroTitle", "hero_title");
    let hero_description = string_field(value, "heroDescription", "hero_description");
    let summary_items: Vec<Value> = value
        .get("summaryItems")
        .or_else(|| value.get("summary_items"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .map(|item| {
                    json!({
                        "title": item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim(),
                        "description": item.get("description").and_then(|v| v.as_str()).unwrap_or("").trim(),
                    })
                })
                .filter(|item| {
                    item.get("title").and_then(|v| v.as_str()).unwrap_or("").len() > 0
                        && item
                            .get("description")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .len()
                            > 0
                })
                .take(3)
                .collect()
        })
        .unwrap_or_default();

    json!({
        "heroTitle": hero_title,
        "heroDescription": hero_description,
        "summaryItems": summary_items,
    })
}

fn has_overview_text_content(value: &Value) -> bool {
    value
        .get("heroTitle")
        .and_then(|v| v.as_str())
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
        || value
            .get("heroDescription")
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
        || value
            .get("summaryItems")
            .and_then(|v| v.as_array())
            .map(|items| !items.is_empty())
            .unwrap_or(false)
}

async fn persist_overview_text_cache(state: &AppState, value: &Value) -> Result<(), String> {
    if !has_overview_text_content(value) {
        return Ok(());
    }

    let raw = serde_json::to_string(value).map_err(|e| e.to_string())?;
    let mut to_save = HashMap::new();
    to_save.insert(WORKBENCH_OVERVIEW_CACHE_KEY.to_string(), raw.clone());
    upsert_settings(&state.db, &to_save).await?;
    state
        .settings
        .write()
        .await
        .insert(WORKBENCH_OVERVIEW_CACHE_KEY.to_string(), raw);
    Ok(())
}

#[tauri::command]
pub async fn workbench_get_overview_text_cache(
    state: State<'_, AppState>,
) -> Result<Option<Value>, String> {
    let cached = state
        .settings
        .read()
        .await
        .get(WORKBENCH_OVERVIEW_CACHE_KEY)
        .cloned();
    let Some(raw) = cached else {
        return Ok(None);
    };

    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    let normalized = normalize_overview_text(&parsed);
    if has_overview_text_content(&normalized) {
        Ok(Some(normalized))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn workbench_generate_overview_text(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    source_json: String,
) -> Result<serde_json::Value, String> {
    let hint_id = Uuid::new_v4().to_string();
    let _ = app.emit(
        "interest:agent_start",
        json!({
            "id": "workbench_overview",
            "agent": {
                "id": hint_id,
                "name": "工作台概览",
                "role": "生成首页动态建议",
                "status": "running"
            }
        }),
    );

    let outcome = async {
        let settings = state.settings.read().await.clone();
        let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;

        let messages = vec![
            LlmMessage::system(WORKBENCH_OVERVIEW_SYSTEM),
            LlmMessage::user(source_json),
        ];
        let model = resolve_model(&settings, &["planner_hint_model"]);
        let temperature = resolve_temperature(&settings, "planner_hint_temperature", 0.2);
        let response = client
            .chat(&messages, model.as_deref(), temperature)
            .await
            .map_err(|e| e.to_string())?;
        let clean = crate::commands::papers::extract_json_pub(&response);
        let parsed: Value =
            serde_json::from_str(&clean).map_err(|e| format!("无法解析工作台概览 JSON: {e}"))?;
        let normalized = normalize_overview_text(&parsed);
        persist_overview_text_cache(state.inner(), &normalized).await?;
        Ok::<_, String>(normalized)
    }
    .await;

    match outcome {
        Ok(v) => {
            let _ = app.emit(
                "interest:agent_complete",
                json!({ "id": "workbench_overview", "agent": { "id": hint_id } }),
            );
            Ok(v)
        }
        Err(e) => {
            let _ = app.emit(
                "interest:error",
                json!({ "id": "workbench_overview", "error": &e }),
            );
            Err(e)
        }
    }
}
