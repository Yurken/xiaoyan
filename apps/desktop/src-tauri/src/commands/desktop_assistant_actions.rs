//! 桌面助手模型动作、导入与文件候选命令。
//!
//! 参数校验后委托 desktop_assistant service；流式任务句柄仅在 command 层编排。

use serde::{Deserialize, Serialize};
use tauri::{command, Emitter, Manager, State};
use uuid::Uuid;

use crate::llm::LlmClient;
use crate::services::desktop_assistant::action_service::{
    ActionMetadata, ActionResult, ActionService, AssistantAction, AssistantHistoryMessage,
};
use crate::services::desktop_assistant::capture_store::CaptureStore;
use crate::services::desktop_assistant::file_candidate_service::{
    AssistantFileCandidate, FileCandidateInspection, FileCandidateService,
};
use crate::services::desktop_assistant::import_service::{AssistantImportOptions, ImportService};
use crate::services::desktop_assistant::knowledge_service::{
    AssistantKnowledgeContext, AssistantKnowledgeService, AssistantKnowledgeTheme,
};
use crate::services::desktop_assistant::metrics_service::{
    AssistantMetricsService, MetricEvent,
};
use crate::services::desktop_assistant::terminology_service::AssistantTerminologyService;
use crate::state::AppState;

use super::desktop_assistant::ensure_assistant_enabled;

/// 匿名本地指标：动作完成/失败打点。失败绝不阻断主流程。
async fn record_action_metric(
    db: &sqlx::SqlitePool,
    action: &'static str,
    source_type: Option<&str>,
    started: std::time::Instant,
    ok: bool,
) {
    AssistantMetricsService::record_quiet(
        db,
        MetricEvent::action_result(
            action,
            source_type,
            started.elapsed().as_millis() as u64,
            ok,
        ),
    )
    .await;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionResultResponse {
    pub id: String,
    pub session_id: String,
    pub action: String,
    pub content: String,
    pub format: String,
    pub metadata: Option<ActionMetadata>,
}

fn action_response(result: ActionResult) -> ActionResultResponse {
    let action = match result.action {
        AssistantAction::Interpret => "interpret",
        AssistantAction::Translate => "translate",
        AssistantAction::Chat => "chat",
        AssistantAction::Import => "import",
        AssistantAction::ExtractText => "extract_text",
    };
    ActionResultResponse {
        id: result.id,
        session_id: result.session_id,
        action: action.to_string(),
        content: result.content,
        format: result.format,
        metadata: result.metadata,
    }
}

fn assistant_action_client(
    settings: &std::collections::HashMap<String, String>,
    content: &str,
) -> Result<(LlmClient, Option<String>), String> {
    if content.starts_with("data:image/") {
        return LlmClient::vision_client_from_settings(settings).ok_or_else(|| {
            "截图操作需要视觉模型，请先在「设置 → 模型角色 → 视界·视觉」中完成配置。".to_string()
        });
    }
    LlmClient::from_settings(settings)
        .map(|client| (client, None))
        .map_err(|e| e.to_string())
}

fn assistant_action_request_id(request_id: Option<String>) -> Result<String, String> {
    let request_id = request_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    if request_id.len() > 128
        || request_id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err("请求标识无效".to_string());
    }
    Ok(request_id)
}

fn parse_stream_action(action: &str) -> Result<AssistantAction, String> {
    match action.trim() {
        "interpret" => Ok(AssistantAction::Interpret),
        "translate" => Ok(AssistantAction::Translate),
        "chat" => Ok(AssistantAction::Chat),
        "import" => Err("导入不是生成动作，无需流式执行".to_string()),
        "extract_text" => Err("提取文字是非流式动作，请使用 assistant_extract_text".to_string()),
        _ => Err("不支持的助手动作".to_string()),
    }
}

fn assistant_knowledge_query(
    action: &AssistantAction,
    content: &str,
    question: Option<&str>,
) -> Result<String, String> {
    if matches!(action, AssistantAction::Translate | AssistantAction::Import) {
        return Err("本地知识仅用于解读和追问".to_string());
    }
    if let Some(question) = question.map(str::trim).filter(|value| !value.is_empty()) {
        return Ok(question.chars().take(2_000).collect());
    }
    if content.starts_with("data:image/") {
        return Err("图片场景请先输入检索问题，再启用本地知识".to_string());
    }
    let content = content.trim();
    if content.is_empty() {
        return Err("本地知识检索需要文本内容或明确问题".to_string());
    }
    Ok(content.chars().take(2_000).collect())
}

async fn load_knowledge_context(
    state: &AppState,
    action: &AssistantAction,
    content: &str,
    question: Option<&str>,
    local_knowledge_enabled: bool,
    knowledge_theme_id: Option<&str>,
) -> Result<Option<AssistantKnowledgeContext>, String> {
    if !local_knowledge_enabled {
        return Ok(None);
    }
    let theme_id = knowledge_theme_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "请先选择要检索的研究主题".to_string())?;
    let query = assistant_knowledge_query(action, content, question)?;
    AssistantKnowledgeService::retrieve(&state.db, theme_id, &query)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_list_knowledge_themes(
    state: State<'_, AppState>,
) -> Result<Vec<AssistantKnowledgeTheme>, String> {
    ensure_assistant_enabled()?;
    AssistantKnowledgeService::list_themes(&state.db)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_interpret(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    question: Option<String>,
    interpret_mode: Option<String>,
) -> Result<ActionResultResponse, String> {
    ensure_assistant_enabled()?;
    CaptureStore::require_confirmed(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    let settings = state.settings.read().await.clone();
    let (llm, model) = assistant_action_client(&settings, &content)?;
    let started = std::time::Instant::now();
    let source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let result = ActionService::interpret(
        &llm,
        model.as_deref(),
        &session_id,
        &content,
        question.as_deref(),
        interpret_mode.as_deref(),
        None,
    )
    .await
    .map_err(|e| e.to_string());
    record_action_metric(
        &state.db,
        "interpret",
        source_type.as_deref(),
        started,
        result.is_ok(),
    )
    .await;

    Ok(action_response(result?))
}

#[command]
pub async fn assistant_translate(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    target_lang: Option<String>,
    terminology_style: Option<String>,
) -> Result<ActionResultResponse, String> {
    ensure_assistant_enabled()?;
    CaptureStore::require_confirmed(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    let settings = state.settings.read().await.clone();
    let (llm, model) = assistant_action_client(&settings, &content)?;
    let terminology_preferences = AssistantTerminologyService::matching(
        &state.db,
        &content,
        target_lang.as_deref().unwrap_or("zh"),
    )
    .await
    .map_err(|error| error.to_string())?;
    let started = std::time::Instant::now();
    let source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let result = ActionService::translate(
        &llm,
        model.as_deref(),
        &session_id,
        &content,
        target_lang.as_deref(),
        terminology_style.as_deref(),
        &terminology_preferences,
    )
    .await
    .map_err(|e| e.to_string());
    record_action_metric(
        &state.db,
        "translate",
        source_type.as_deref(),
        started,
        result.is_ok(),
    )
    .await;

    Ok(action_response(result?))
}

#[command]
pub async fn assistant_chat(
    state: State<'_, AppState>,
    session_id: String,
    context: String,
    question: String,
) -> Result<ActionResultResponse, String> {
    ensure_assistant_enabled()?;
    CaptureStore::require_confirmed(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    let settings = state.settings.read().await.clone();
    let (llm, model) = assistant_action_client(&settings, &context)?;
    let started = std::time::Instant::now();
    let source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let result = ActionService::chat(
        &llm,
        model.as_deref(),
        &session_id,
        &context,
        true,
        &question,
        &[],
        None,
    )
    .await
    .map_err(|e| e.to_string());
    record_action_metric(
        &state.db,
        "chat",
        source_type.as_deref(),
        started,
        result.is_ok(),
    )
    .await;

    Ok(action_response(result?))
}

#[command]
pub async fn assistant_extract_text(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
) -> Result<ActionResultResponse, String> {
    ensure_assistant_enabled()?;
    // 与截图动作一致：预览确认前不允许发送模型（PRD §12 / §F5）。
    CaptureStore::require_confirmed(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    if !content.starts_with("data:image/") {
        return Err("提取文字仅支持截图内容".to_string());
    }
    let settings = state.settings.read().await.clone();
    // 复用 §19.1 视觉模型路由（桌面助手视觉/OCR 覆盖配置），不引入新依赖。
    let (llm, model) = assistant_action_client(&settings, &content)?;
    let started = std::time::Instant::now();
    let source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let result = ActionService::extract_text(&llm, model.as_deref(), &session_id, &content)
        .await
        .map_err(|e| e.to_string());
    record_action_metric(
        &state.db,
        "extract_text",
        source_type.as_deref(),
        started,
        result.is_ok(),
    )
    .await;

    Ok(action_response(result?))
}

#[command]
#[allow(clippy::too_many_arguments)]
pub async fn assistant_stream_action(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    request_id: Option<String>,
    session_id: String,
    action: String,
    content: String,
    question: Option<String>,
    interpret_mode: Option<String>,
    target_lang: Option<String>,
    terminology_style: Option<String>,
    local_knowledge_enabled: bool,
    knowledge_theme_id: Option<String>,
    history: Option<Vec<AssistantHistoryMessage>>,
    include_capture_context: bool,
) -> Result<String, String> {
    ensure_assistant_enabled()?;
    // A clear operation takes the write side of this lock. Holding the read side
    // until registration prevents a prepared stream from appearing after clear.
    let registration_guard = state.assistant_action_lifecycle.read().await;
    CaptureStore::require_confirmed(&state.db, &session_id)
        .await
        .map_err(|error| error.to_string())?;
    let request_id = assistant_action_request_id(request_id)?;
    let action = parse_stream_action(&action)?;
    let knowledge_context = load_knowledge_context(
        &state,
        &action,
        &content,
        question.as_deref(),
        local_knowledge_enabled,
        knowledge_theme_id.as_deref(),
    )
    .await?;
    let terminology_preferences = if matches!(action, AssistantAction::Translate) {
        AssistantTerminologyService::matching(
            &state.db,
            &content,
            target_lang.as_deref().unwrap_or("zh"),
        )
        .await
        .map_err(|error| error.to_string())?
    } else {
        Vec::new()
    };
    let settings = state.settings.read().await.clone();
    let client_content = if matches!(action, AssistantAction::Chat) && !include_capture_context {
        ""
    } else {
        &content
    };
    let (llm, model) = assistant_action_client(&settings, client_content)?;
    let handles = state.assistant_action_handles.clone();
    let stream_id = request_id.clone();
    let history = history.unwrap_or_default();
    let metrics_db = state.db.clone();
    let metrics_action: &'static str = match &action {
        AssistantAction::Interpret => "interpret",
        AssistantAction::Translate => "translate",
        AssistantAction::Chat => "chat",
        AssistantAction::Import => unreachable!("import is rejected before spawning"),
        AssistantAction::ExtractText => unreachable!("extract_text is rejected before spawning"),
    };
    let metrics_source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let metrics_started = std::time::Instant::now();

    let handle = tokio::spawn(async move {
        let delta_id = stream_id.clone();
        let delta_app = app.clone();
        let on_delta = move |delta| {
            let _ = delta_app.emit(
                "assistant:action-delta",
                serde_json::json!({ "request_id": &delta_id, "delta": delta }),
            );
        };
        let result = match action {
            AssistantAction::Interpret => {
                ActionService::interpret_stream(
                    &llm,
                    model.as_deref(),
                    &session_id,
                    &content,
                    question.as_deref(),
                    interpret_mode.as_deref(),
                    knowledge_context.as_ref(),
                    on_delta,
                )
                .await
            }
            AssistantAction::Translate => {
                ActionService::translate_stream(
                    &llm,
                    model.as_deref(),
                    &session_id,
                    &content,
                    target_lang.as_deref(),
                    terminology_style.as_deref(),
                    &terminology_preferences,
                    on_delta,
                )
                .await
            }
            AssistantAction::Chat => {
                ActionService::chat_stream(
                    &llm,
                    model.as_deref(),
                    &session_id,
                    &content,
                    include_capture_context,
                    question.as_deref().unwrap_or_default(),
                    &history,
                    knowledge_context.as_ref(),
                    on_delta,
                )
                .await
            }
            AssistantAction::Import => unreachable!("import is rejected before spawning"),
            AssistantAction::ExtractText => {
                unreachable!("extract_text is rejected before spawning")
            }
        };

        let ok = result.is_ok();
        match result {
            Ok(result) => {
                let _ = app.emit(
                    "assistant:action-done",
                    serde_json::json!({
                        "request_id": &stream_id,
                        "result": action_response(result),
                    }),
                );
            }
            Err(error) => {
                let _ = app.emit(
                    "assistant:action-error",
                    serde_json::json!({
                        "request_id": &stream_id,
                        "error": error.to_string(),
                    }),
                );
            }
        }
        record_action_metric(
            &metrics_db,
            metrics_action,
            metrics_source_type.as_deref(),
            metrics_started,
            ok,
        )
        .await;
        handles.lock().await.remove(&stream_id);
    });

    let mut handles = state.assistant_action_handles.lock().await;
    if let Some(previous) = handles.insert(request_id.clone(), handle) {
        previous.abort();
    }
    if handles
        .get(&request_id)
        .is_some_and(|handle| handle.is_finished())
    {
        handles.remove(&request_id);
    }
    drop(handles);
    drop(registration_guard);
    Ok(request_id)
}

#[command]
pub async fn assistant_cancel_action(
    state: State<'_, AppState>,
    request_id: String,
) -> Result<(), String> {
    if let Some(handle) = state
        .assistant_action_handles
        .lock()
        .await
        .remove(request_id.trim())
    {
        handle.abort();
        AssistantMetricsService::record_quiet(
            &state.db,
            MetricEvent {
                event_type: "action".to_string(),
                action: None,
                source_type: None,
                target: None,
                duration_ms: None,
                status: "cancelled".to_string(),
            },
        )
        .await;
    }
    Ok(())
}

#[command]
pub async fn assistant_import(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    session_id: String,
    content: String,
    target: String,
    title: Option<String>,
    tags: Option<Vec<String>>,
    research_theme_id: Option<String>,
    preserve_original: bool,
    original_content: Option<String>,
    retention_policy: String,
) -> Result<ActionResultResponse, String> {
    ensure_assistant_enabled()?;
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let started = std::time::Instant::now();
    let source_type = CaptureStore::session_source_type(&state.db, &session_id)
        .await
        .ok()
        .flatten();
    let result = ImportService::import(
        &state.db,
        &app_data_dir,
        &session_id,
        &content,
        &target,
        AssistantImportOptions {
            title: title.as_deref(),
            tags: tags.as_deref(),
            research_theme_id: research_theme_id.as_deref(),
            preserve_original,
            original_content: original_content.as_deref(),
            retention_policy: &retention_policy,
        },
    )
    .await
    .map_err(|e| e.to_string());
    let ok = result.is_ok();
    // target 是结构化枚举值；白名单外的值会被校验拒绝，事件直接丢弃。
    if let Ok(event) = MetricEvent::new(
        "import",
        None,
        source_type.as_deref(),
        Some(&target),
        Some(started.elapsed().as_millis() as u64),
        if ok { "success" } else { "error" },
    ) {
        AssistantMetricsService::record_quiet(&state.db, event).await;
    }

    Ok(action_response(result?))
}

#[command]
pub async fn assistant_create_file_candidates(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<FileCandidateInspection, String> {
    ensure_assistant_enabled()?;
    FileCandidateService::inspect_and_create(&state.db, paths)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_confirm_file_candidates(
    state: State<'_, AppState>,
    candidate_ids: Vec<String>,
) -> Result<Vec<AssistantFileCandidate>, String> {
    ensure_assistant_enabled()?;
    FileCandidateService::confirm(&state.db, candidate_ids)
        .await
        .map_err(|error| error.to_string())
}

#[command]
pub async fn assistant_discard_file_candidates(
    state: State<'_, AppState>,
    candidate_ids: Vec<String>,
) -> Result<u64, String> {
    FileCandidateService::discard(&state.db, candidate_ids)
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stream_action_rejects_extract_text() {
        // 提取文字是非流式动作，走 assistant_extract_text 命令。
        assert!(parse_stream_action("extract_text").is_err());
        assert!(parse_stream_action("interpret").is_ok());
    }

    #[test]
    fn knowledge_query_prefers_explicit_question_and_limits_length() {
        let query = assistant_knowledge_query(
            &AssistantAction::Interpret,
            "captured context",
            Some(&"研".repeat(2_100)),
        )
        .unwrap();
        assert_eq!(query.chars().count(), 2_000);
        assert!(query.chars().all(|character| character == '研'));
    }

    #[test]
    fn knowledge_query_requires_a_question_for_images() {
        assert!(assistant_knowledge_query(
            &AssistantAction::Interpret,
            "data:image/png;base64,iVBORw0KGgo=",
            None,
        )
        .is_err());
        assert_eq!(
            assistant_knowledge_query(
                &AssistantAction::Chat,
                "data:image/png;base64,iVBORw0KGgo=",
                Some("这张图的趋势是什么？"),
            )
            .unwrap(),
            "这张图的趋势是什么？"
        );
    }

    #[test]
    fn knowledge_query_is_not_available_for_translation() {
        assert!(assistant_knowledge_query(
            &AssistantAction::Translate,
            "research context",
            Some("translate"),
        )
        .is_err());
    }
}
