use crate::commands::paper_analysis_prompts::{build_polish_prompt, polish_system};
use crate::commands::papers::extract_json_pub;
use crate::llm::{resolve_max_tokens, resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct PolishTextRequest {
    pub text: String,
    #[serde(default = "default_section")]
    pub section: String,
    #[serde(default = "default_direction")]
    pub direction: String,
}

fn default_section() -> String {
    "free".to_string()
}

fn default_direction() -> String {
    "polish".to_string()
}

#[tauri::command]
pub async fn writing_polish_text(
    state: State<'_, AppState>,
    request: PolishTextRequest,
) -> Result<serde_json::Value, String> {
    let text = request.text.trim();
    if text.is_empty() {
        return Err("请输入需要润色的文本。".to_string());
    }

    let settings = state.settings.read().await.clone();
    let client = LlmClient::from_settings(&settings).map_err(|e| e.to_string())?;
    let model = resolve_model(
        &settings,
        &[
            "writing_polish_model",
            "paper_analysis_model",
            "multi_agent_paper_analyst_model",
            "multi_agent_worker_model",
        ],
    );
    let temperature = resolve_temperature(&settings, "writing_polish_temperature", 0.3);
    let max_tokens = resolve_max_tokens(
        &settings,
        &[
            "writing_polish_max_tokens",
            "paper_analysis_max_tokens",
            "multi_agent_paper_analyst_max_tokens",
            "multi_agent_worker_max_tokens",
        ],
        16_384,
    );

    let prompt = build_polish_prompt(&request.section, &request.direction, text);
    let msgs = vec![LlmMessage::system(polish_system()), LlmMessage::user(&prompt)];

    let response = client
        .chat_with_max_tokens(&msgs, model.as_deref(), temperature, max_tokens)
        .await
        .map_err(|e| format!("润色失败：{}", e))?;

    let clean = extract_json_pub(&response);
    serde_json::from_str::<serde_json::Value>(&clean).map_err(|error| {
        if error.is_eof() {
            "模型输出在 JSON 中途被截断，通常是 max_tokens 不足或回复过长。请提高当前功能对应的 max_tokens，或缩短模型输出。".to_string()
        } else {
            format!("模型返回的 JSON 解析失败：{error}")
        }
    })
}
