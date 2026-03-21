use std::{
    fs::OpenOptions,
    io::Write,
    panic,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

mod ccf;
mod commands;
mod db;
mod llm;
mod links;
mod rag;
mod state;

use tauri::Manager;

use commands::{
    ccf::ccf_lookup,
    chat::{
        chat_delete_session, chat_get_session, chat_list_agent_runs, chat_list_sessions,
        chat_stream,
    },
    knowledge::{
        knowledge_create_interest, knowledge_create_note, knowledge_delete_note,
        knowledge_generate_interest_hints, knowledge_generate_plan,
        knowledge_list_interests, knowledge_list_notes, knowledge_search,
        knowledge_update_note,
    },
    misc::{planner_generate, survey_generate, survey_search},
    papers::{papers_analyze, papers_delete, papers_get, papers_list, papers_reproduce, papers_update, papers_upload},
    settings::{settings_get, settings_test, settings_update},
};
use state::{default_settings, AppState};

fn diagnostic_log_path() -> PathBuf {
    std::env::temp_dir().join("research-copilot-desktop.log")
}

fn append_diagnostic_log(message: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(diagnostic_log_path())
    {
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    panic::set_hook(Box::new(|panic_info| {
        append_diagnostic_log(&format!("panic: {panic_info}"));
    }));

    append_diagnostic_log("startup: begin");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");

            append_diagnostic_log(&format!(
                "startup: setup ok version={} data_dir={}",
                app.package_info().version,
                app_data_dir.display()
            ));

            // Initialise DB + settings on the async runtime
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                // Init SQLite
                let pool = db::init_db(&app_data_dir).await.expect("failed to init DB");

                // Load persisted settings, merge with defaults
                let mut settings = default_settings();
                let rows = sqlx::query("SELECT key, value FROM settings")
                    .fetch_all(&pool)
                    .await;
                match rows {
                    Ok(rows) => {
                        use sqlx::Row;
                        let count = rows.len();
                        for row in rows {
                            let key: String = row.get("key");
                            let value: String = row.get("value");
                            settings.insert(key, value);
                        }
                        append_diagnostic_log(&format!("startup: loaded {count} settings from db"));
                    }
                    Err(e) => {
                        append_diagnostic_log(&format!("startup: failed to load settings: {e}"));
                    }
                }

                let app_state = AppState::new(pool, settings);
                handle.manage(app_state);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings_get,
            settings_update,
            settings_test,
            // Papers
            papers_list,
            papers_get,
            papers_upload,
            papers_update,
            papers_delete,
            papers_analyze,
            papers_reproduce,
            // CCF
            ccf_lookup,
            // Knowledge
            knowledge_list_interests,
            knowledge_create_interest,
            knowledge_generate_interest_hints,
            knowledge_generate_plan,
            knowledge_list_notes,
            knowledge_create_note,
            knowledge_update_note,
            knowledge_delete_note,
            knowledge_search,
            // Chat
            chat_list_sessions,
            chat_get_session,
            chat_delete_session,
            chat_list_agent_runs,
            chat_stream,
            // Misc
            planner_generate,
            survey_generate,
            survey_search,
        ])
        .run(tauri::generate_context!());

    match builder {
        Ok(()) => append_diagnostic_log("startup: shutdown clean"),
        Err(error) => append_diagnostic_log(&format!("startup: run error: {error}")),
    }
}
