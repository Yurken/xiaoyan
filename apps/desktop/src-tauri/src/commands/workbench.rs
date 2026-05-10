use crate::llm::{resolve_model, resolve_temperature, LlmClient, LlmMessage};
use crate::state::AppState;
use serde_json::json;
use tauri::{Emitter, State};
use uuid::Uuid;

const WORKBENCH_OVERVIEW_SYSTEM: &str = r#"你是一位研究助手"小妍"，负责为研究者生成工作台首页的动态概览文案。

你的输出必须是严格的 JSON，格式如下：
{
  "hero_title": "一句话标题（≤25字），点明当前最值得关注的研究推进方向",
  "hero_description": "一段话（≤80字），概括当前研究状态：值得继续的主题、刚交回来的结果、容易拖慢的事项",
  "summary_items": [
    { "title": "摘要标题1（≤15字）", "description": "简短描述（≤30字）" },
    { "title": "摘要标题2", "description": "简短描述" },
    { "title": "摘要标题3", "description": "简短描述" }
  ]
}

要求：
- 语气温和、鼓励，用"你"称呼研究者
- hero_title 要有行动感，让研究者知道下一步该做什么
- hero_description 要具体提到数据中的数字和状态，不要泛泛而谈
- summary_items 必须 3 条，分别覆盖：投稿状态、最优先主题、知识沉淀
- 如果某项数据为空或不存在，诚实说明而不是编造
- 只输出 JSON，不要包含其他文字或 markdown 标记"#;

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
        let parsed: serde_json::Value =
            serde_json::from_str(&clean).map_err(|e| format!("无法解析工作台概览 JSON: {e}"))?;

        let hero_title = parsed
            .get("hero_title")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();
        let hero_description = parsed
            .get("hero_description")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();
        let summary_items: Vec<serde_json::Value> = parsed
            .get("summary_items")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|item| {
                        json!({
                            "title": item.get("title").and_then(|v| v.as_str()).unwrap_or(""),
                            "description": item.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok::<_, String>(json!({
            "heroTitle": hero_title,
            "heroDescription": hero_description,
            "summaryItems": summary_items,
        }))
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
