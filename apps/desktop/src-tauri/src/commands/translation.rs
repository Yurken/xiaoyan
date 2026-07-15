use crate::assistant_prompts::specialist_system;
use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use tauri::{Emitter, State};
use uuid::Uuid;

fn translation_messages(
    text: &str,
    target_lang: &str,
    source_lang: Option<&str>,
) -> Vec<LlmMessage> {
    let lang_map: &[(&str, &str)] = &[
        ("zh", "简体中文"),
        ("en", "English"),
        ("ja", "日本語"),
        ("de", "Deutsch"),
        ("fr", "Français"),
    ];
    let target_display = lang_map
        .iter()
        .find(|(code, _)| *code == target_lang)
        .map(|(_, name)| *name)
        .unwrap_or(target_lang);
    let source_hint = source_lang
        .map(|source| {
            let source_display = lang_map
                .iter()
                .find(|(code, _)| *code == source)
                .map(|(_, name)| *name)
                .unwrap_or(source);
            format!("原文语言：{source_display}\n")
        })
        .unwrap_or_else(|| "原文语言：自动识别\n".to_string());
    let system = specialist_system(
        "学术翻译专家",
        "将学术文本精准翻译为目标语言，严格保留专业术语、保持学术写作风格，不增删原文内容。",
        Some("只返回译文，不加任何解释、标注或前缀。"),
    );
    let user = format!("{source_hint}目标语言：{target_display}\n\n原文：\n{text}");

    vec![LlmMessage::system(system), LlmMessage::user(&user)]
}

fn translation_model(
    settings: &std::collections::HashMap<String, String>,
    model: Option<String>,
) -> Option<String> {
    model
        .filter(|value| !value.trim().is_empty())
        .or_else(|| resolve_model(settings, &["translation_model"]))
}

#[tauri::command]
pub async fn translate_text(
    state: State<'_, AppState>,
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|error| error.to_string())?;
    let messages = translation_messages(&text, &target_lang, source_lang.as_deref());
    client
        .chat(
            &messages,
            translation_model(&settings, model).as_deref(),
            resolve_temperature(&settings, "translation_temperature", 0.1),
        )
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn translate_stream(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    text: String,
    target_lang: String,
    source_lang: Option<String>,
    model: Option<String>,
    request_id: Option<String>,
) -> Result<String, String> {
    let request_id = request_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|error| error.to_string())?;
    let messages = translation_messages(&text, &target_lang, source_lang.as_deref());
    let model = translation_model(&settings, model);
    let temperature = resolve_temperature(&settings, "translation_temperature", 0.1);
    let handles = state.translation_handles.clone();
    let stream_id = request_id.clone();

    let handle = tokio::spawn(async move {
        let delta_id = stream_id.clone();
        let delta_app = app.clone();
        let result = client
            .stream_chat(&messages, model.as_deref(), temperature, move |delta| {
                let _ = delta_app.emit(
                    "translation:delta",
                    json!({ "request_id": &delta_id, "delta": delta }),
                );
            })
            .await;
        match result {
            Ok(_) => {
                let _ = app.emit("translation:done", json!({ "request_id": &stream_id }));
            }
            Err(error) => {
                let _ = app.emit(
                    "translation:error",
                    json!({ "request_id": &stream_id, "error": error.to_string() }),
                );
            }
        }
        handles.lock().await.remove(&stream_id);
    });

    let mut handles = state.translation_handles.lock().await;
    handles.insert(request_id.clone(), handle);
    if handles
        .get(&request_id)
        .is_some_and(|handle| handle.is_finished())
    {
        handles.remove(&request_id);
    }

    Ok(request_id)
}

#[tauri::command]
pub async fn translate_cancel(
    state: State<'_, AppState>,
    request_id: String,
) -> Result<(), String> {
    if let Some(handle) = state.translation_handles.lock().await.remove(&request_id) {
        handle.abort();
    }
    Ok(())
}
