use std::{
    fs::OpenOptions,
    io::Write,
    panic,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

mod agent_graph;
mod agent_nodes;
mod assistant_prompts;
mod ccf;
mod citation_graph;
mod commands;
mod db;
mod graph_rag;
mod journal_partitions;
mod links;
mod llm;
mod markitdown_runtime;
mod rag;
mod repositories;
mod services;
mod state;

use tauri::Manager;

use commands::{
    arxiv::arxiv_search,
    ccf::ccf_lookup,
    chat::{
        chat_delete_session, chat_get_session, chat_list_agent_runs, chat_list_sessions,
        chat_stream, chat_update_session_context,
    },
    citation_graph::{
        knowledge_graph_citation_centrality, knowledge_graph_citation_shortest_path,
        knowledge_graph_citation_subgraph,
    },
    experiment::{
        experiment_add_attachment, experiment_create, experiment_delete,
        experiment_delete_attachment, experiment_get, experiment_list, experiment_list_attachments,
        experiment_update, experiment_update_attachment_label,
    },
    export::export_to_obsidian,
    journal::{journal_lookup, journal_rank_filter},
    knowledge::{
        knowledge_create_interest, knowledge_delete_interest_bundle,
        knowledge_delete_interest_only, knowledge_generate_interest_hints, knowledge_generate_plan,
        knowledge_list_interests, knowledge_suggest_topics, knowledge_update_interest_folder,
        knowledge_web_clip,
    },
    knowledge_graph::{
        knowledge_graph_create_citation, knowledge_graph_create_claim,
        knowledge_graph_create_evidence, knowledge_graph_delete_citation,
        knowledge_graph_delete_claim, knowledge_graph_delete_evidence, knowledge_graph_snapshot,
    },
    knowledge_notes::{
        knowledge_create_note, knowledge_delete_note, knowledge_list_notes, knowledge_move_note,
        knowledge_search, knowledge_update_note,
    },
    memory::{
        memory_add, memory_build_context, memory_clear_auto, memory_delete, memory_list,
        memory_list_observations, memory_search_observations,
    },
    misc::{
        markdown_format_chunk, planner_generate, survey_generate, survey_search, translate_text,
    },
    paper_search::paper_search,
    papers::{
        papers_analyze, papers_delete, papers_extract_pdf_text, papers_get, papers_list,
        papers_list_figures, papers_open_pdf, papers_reproduce, papers_update, papers_upload,
    },
    settings::{
        settings_export, settings_get, settings_import, settings_list_ollama_models, settings_test,
        settings_update,
    },
    skills::{skills_create, skills_delete, skills_list, skills_reset_builtins, skills_update},
    source::source_lookup,
    submission::{
        submission_ai_review, submission_create, submission_create_comment,
        submission_create_venue, submission_create_version, submission_delete,
        submission_delete_comment, submission_delete_venue, submission_delete_version,
        submission_generate_cover_letter, submission_get_checklist, submission_list,
        submission_list_comments, submission_list_rounds, submission_list_venues,
        submission_list_versions, submission_polish_abstract, submission_stats,
        submission_toggle_checklist, submission_toggle_venue_star, submission_update,
        submission_update_comment, submission_update_venue, submission_upsert_round,
    },
    update::{update_check, update_install, PendingUpdate},
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            app.manage(PendingUpdate::default());

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

                let app_state = AppState::new(pool.clone(), settings);
                handle.manage(app_state);

                // Backfill keywords for existing papers that have full_text but empty tags
                tauri::async_runtime::spawn(async move {
                    use sqlx::Row;
                    use commands::papers::extract_keywords_from_text;
                    let rows = sqlx::query(
                        "SELECT id, full_text FROM papers WHERE (tags IS NULL OR tags = '[]') AND full_text IS NOT NULL AND full_text != ''",
                    )
                    .fetch_all(&pool)
                    .await
                    .unwrap_or_default();
                    for row in rows {
                        let id: String = row.get("id");
                        let full_text: String = row.get("full_text");
                        let keywords = extract_keywords_from_text(&full_text);
                        if keywords.is_empty() { continue; }
                        let tags_json = serde_json::to_string(&keywords).unwrap_or_else(|_| "[]".to_string());
                        let _ = sqlx::query("UPDATE papers SET tags = ? WHERE id = ?")
                            .bind(&tags_json)
                            .bind(&id)
                            .execute(&pool)
                            .await;
                    }
                });
            });

            // 确保 macOS Dock 图标与窗口图标一致
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings_get,
            settings_update,
            settings_test,
            settings_export,
            settings_import,
            update_check,
            update_install,
            // Papers
            papers_list,
            papers_get,
            papers_upload,
            papers_update,
            papers_delete,
            papers_open_pdf,
            papers_extract_pdf_text,
            papers_analyze,
            papers_reproduce,
            papers_list_figures,
            // CCF
            ccf_lookup,
            // Journal partitions
            journal_lookup,
            journal_rank_filter,
            // Unified source lookup
            source_lookup,
            // arXiv
            arxiv_search,
            // Paper search
            paper_search,
            // Knowledge
            knowledge_list_interests,
            knowledge_create_interest,
            knowledge_update_interest_folder,
            knowledge_delete_interest_bundle,
            knowledge_delete_interest_only,
            knowledge_generate_interest_hints,
            knowledge_suggest_topics,
            knowledge_generate_plan,
            knowledge_list_notes,
            knowledge_create_note,
            knowledge_update_note,
            knowledge_move_note,
            knowledge_delete_note,
            knowledge_search,
            knowledge_graph_snapshot,
            knowledge_graph_create_claim,
            knowledge_graph_delete_claim,
            knowledge_graph_create_evidence,
            knowledge_graph_delete_evidence,
            knowledge_graph_create_citation,
            knowledge_graph_delete_citation,
            knowledge_graph_citation_centrality,
            knowledge_graph_citation_shortest_path,
            knowledge_graph_citation_subgraph,
            // Chat
            chat_list_sessions,
            chat_get_session,
            chat_delete_session,
            chat_update_session_context,
            chat_list_agent_runs,
            chat_stream,
            // Skills
            skills_list,
            skills_create,
            skills_update,
            skills_delete,
            skills_reset_builtins,
            // Memory
            memory_add,
            memory_list,
            memory_list_observations,
            memory_search_observations,
            memory_delete,
            memory_clear_auto,
            memory_build_context,
            // Submission
            submission_list_venues,
            submission_create_venue,
            submission_update_venue,
            submission_delete_venue,
            submission_toggle_venue_star,
            submission_list,
            submission_create,
            submission_update,
            submission_delete,
            submission_list_versions,
            submission_create_version,
            submission_delete_version,
            submission_list_rounds,
            submission_upsert_round,
            submission_list_comments,
            submission_create_comment,
            submission_update_comment,
            submission_delete_comment,
            submission_get_checklist,
            submission_toggle_checklist,
            submission_stats,
            submission_ai_review,
            submission_polish_abstract,
            submission_generate_cover_letter,
            // Experiment
            experiment_list,
            experiment_get,
            experiment_create,
            experiment_update,
            experiment_delete,
            experiment_add_attachment,
            experiment_list_attachments,
            experiment_delete_attachment,
            experiment_update_attachment_label,
            // Export
            export_to_obsidian,
            // Knowledge extras
            knowledge_web_clip,
            // Settings extras
            settings_list_ollama_models,
            // Misc
            planner_generate,
            survey_generate,
            survey_search,
            translate_text,
            markdown_format_chunk,
        ])
        .run(tauri::generate_context!());

    match builder {
        Ok(()) => append_diagnostic_log("startup: shutdown clean"),
        Err(error) => append_diagnostic_log(&format!("startup: run error: {error}")),
    }
}
