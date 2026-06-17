use std::{
    fs::{self, OpenOptions},
    io::Write,
    panic,
    path::PathBuf,
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

mod agent_graph;
mod agent_nodes;
mod agent_workspace;
mod assistant_prompts;
mod ccf;
mod citation_graph;
mod commands;
mod db;
mod graph_rag;
mod journal_partitions;
mod links;
mod llm;
mod rag;
mod repositories;
mod services;
mod state;
mod web_search;

use tauri::Manager;

use commands::{
    active_researcher::{
        active_researcher_findings, active_researcher_mark_read, active_researcher_scan,
    },
    app_lock::{
        app_lock_clear_password, app_lock_get_hint, app_lock_get_recovery_info,
        app_lock_reset_password, app_lock_set_password, app_lock_set_security,
        app_lock_set_timeout, app_lock_status, app_lock_verify_password, app_lock_verify_recovery,
    },
    arxiv::arxiv_search,
    ccf::{ccf_list, ccf_lookup},
    chat::{
        chat_cancel, chat_delete_session, chat_get_session, chat_list_agent_runs,
        chat_list_sessions, chat_stream, chat_update_session_context,
    },
    citation_graph::{
        knowledge_graph_citation_centrality, knowledge_graph_citation_shortest_path,
        knowledge_graph_citation_subgraph,
    },
    data_backup::{data_backup_export, data_backup_import},
    evidence::evidence_get_links,
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
    memory_checkpoints::memory_list_checkpoints,
    memory_privacy::{
        memory_list_auto_records, memory_list_manual_records, memory_list_private_observations,
        memory_privacy_clear_password, memory_privacy_set_password, memory_privacy_status,
        memory_privacy_verify_password,
    },
    misc::{
        markdown_format_chunk, planner_generate, survey_delete, survey_generate, survey_get,
        survey_list, survey_search, translate_text,
    },
    paper_corpus::{
        paper_corpus_create, paper_corpus_delete, paper_corpus_list, paper_corpus_update,
    },
    paper_cross_analysis::papers_cross_analysis,
    paper_figures::papers_list_figures,
    paper_notes::{paper_notes_create, paper_notes_delete, paper_notes_list, paper_notes_update},
    paper_search::paper_search,
    papers::{
        papers_analyze, papers_delete, papers_extract_pdf_text, papers_get, papers_list,
        papers_list_parse_runs, papers_open_pdf, papers_reorder, papers_reparse, papers_reproduce,
        papers_update, papers_upload,
    },
    research_context::{research_context_get_recent_themes, research_context_get_theme_context},
    settings::{
        settings_export, settings_get, settings_history_apply, settings_history_delete,
        settings_history_list, settings_history_save, settings_import, settings_list_ollama_models,
        settings_test, settings_update,
    },
    skills::{skills_create, skills_delete, skills_list, skills_reset_builtins, skills_update},
    source::source_lookup,
    submission::{
        submission_ai_review, submission_create, submission_create_comment,
        submission_create_venue, submission_create_version, submission_delete,
        submission_delete_comment, submission_delete_venue, submission_delete_version,
        submission_generate_cover_letter, submission_get_checklist,
        submission_import_diagnosis_report_to_checklist,
        submission_import_diagnosis_report_to_tasks, submission_list, submission_list_comments,
        submission_list_diagnosis_reports, submission_list_revision_tasks, submission_list_rounds,
        submission_list_venues, submission_list_versions, submission_polish_abstract,
        submission_stats, submission_sync_ccfddl, submission_sync_ccfddl_local,
        submission_toggle_checklist, submission_toggle_venue_star, submission_update,
        submission_update_comment, submission_update_revision_task, submission_update_venue,
        submission_update_version, submission_upsert_round,
    },
    sync::{sync_configure, sync_disable, sync_get_config, sync_now, sync_status},
    update::{update_check, update_install, PendingUpdate},
    webdav_sync::{
        webdav_delete_backup, webdav_download_backup, webdav_list_backups, webdav_test_connection,
        webdav_upload_backup,
    },
    workbench::{workbench_generate_overview_text, workbench_get_overview_text_cache},
    writing::{
        writing_compile_pdf, writing_copy_pdf, writing_import_image, writing_open_compiled_pdf,
        writing_open_mactex_download_page, writing_open_mactex_installer,
    },
};
use state::{default_settings, AppState};

static DIAGNOSTIC_LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

fn diagnostic_log_path() -> PathBuf {
    DIAGNOSTIC_LOG_PATH
        .get()
        .cloned()
        .unwrap_or_else(|| std::env::temp_dir().join("xiaoyan-desktop.log"))
}

fn configure_diagnostic_log_path(app_data_dir: &std::path::Path) {
    let log_dir = app_data_dir.join("logs");
    if fs::create_dir_all(&log_dir).is_ok() {
        let _ = DIAGNOSTIC_LOG_PATH.set(log_dir.join("xiaoyan-desktop.log"));
    }
}

/// Maximum diagnostic log size in bytes before rotation (5 MB).
const MAX_DIAGNOSTIC_LOG_SIZE: u64 = 5 * 1024 * 1024;

pub fn append_diagnostic_log(message: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();

    let log_path = diagnostic_log_path();

    // Rotate if the log exceeds size limit
    if let Ok(meta) = fs::metadata(&log_path) {
        if meta.len() > MAX_DIAGNOSTIC_LOG_SIZE {
            let rotated = log_path.with_extension("log.old");
            let _ = fs::rename(&log_path, &rotated);
        }
    }

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&log_path) {
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

            configure_diagnostic_log_path(&app_data_dir);
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

                // Auto-sync CCF DDL from bundled data on first launch
                {
                    let state = handle.state::<AppState>().inner().clone();
                    let app_handle = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        commands::submission::auto_sync_ccfddl_on_startup(&state, &app_handle).await;
                    });
                }

                // Auto-scan for new papers — fires after a short delay
                {
                    let state = handle.state::<AppState>().inner().clone();
                    let app_handle = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        // Delay to avoid blocking startup
                        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                        commands::active_researcher::auto_researcher_scan_on_startup(&state, &app_handle).await;
                    });
                }

                // WebDAV 无冲突同步：启动后跑一次，之后每 5 分钟自动后台同步。
                // 未配置凭据时 run_sync 直接返回 None，开销可忽略。
                {
                    let state = handle.state::<AppState>().inner().clone();
                    let app_handle = handle.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        let _ = services::sync_service::run_sync(&state, &app_handle).await;
                        let mut ticker =
                            tokio::time::interval(std::time::Duration::from_secs(300));
                        ticker.tick().await; // 立即返回的第一次 tick
                        loop {
                            ticker.tick().await;
                            let _ = services::sync_service::run_sync(&state, &app_handle).await;
                        }
                    });
                }

                // Backfill keywords for existing papers that have full_text but empty tags
                tauri::async_runtime::spawn(async move {
                    use sqlx::Row;
                    use commands::paper_analysis_text::extract_keywords_from_text;
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
        .on_window_event(|window, event| {
            // 窗口重新获得焦点时触发一次同步，让用户切回应用即见最新数据。
            if let tauri::WindowEvent::Focused(true) = event {
                let app = window.app_handle().clone();
                if let Some(state) = app.try_state::<AppState>() {
                    let state = state.inner().clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = services::sync_service::run_sync(&state, &app).await;
                    });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Settings
            settings_get,
            settings_update,
            settings_test,
            settings_export,
            settings_import,
            settings_history_list,
            settings_history_save,
            settings_history_apply,
            settings_history_delete,
            update_check,
            update_install,
            // Papers
            papers_list,
            papers_get,
            papers_list_parse_runs,
            papers_upload,
            papers_update,
            papers_reorder,
            papers_delete,
            papers_open_pdf,
            papers_extract_pdf_text,
            papers_reparse,
            papers_analyze,
            papers_reproduce,
            papers_list_figures,
            // Paper notes (PDF reader annotations)
            paper_notes_list,
            paper_notes_create,
            paper_notes_update,
            paper_notes_delete,
            paper_corpus_list,
            paper_corpus_create,
            paper_corpus_update,
            paper_corpus_delete,
            // CCF
            ccf_list,
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
            chat_cancel,
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
            memory_list_checkpoints,
            memory_search_observations,
            memory_list_manual_records,
            memory_list_auto_records,
            memory_list_private_observations,
            memory_privacy_status,
            memory_privacy_set_password,
            memory_privacy_verify_password,
            memory_privacy_clear_password,
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
            submission_update_version,
            submission_delete_version,
            submission_list_rounds,
            submission_upsert_round,
            submission_list_comments,
            submission_create_comment,
            submission_update_comment,
            submission_delete_comment,
            submission_get_checklist,
            submission_toggle_checklist,
            submission_list_diagnosis_reports,
            submission_import_diagnosis_report_to_checklist,
            submission_list_revision_tasks,
            submission_import_diagnosis_report_to_tasks,
            submission_update_revision_task,
            submission_stats,
            submission_ai_review,
            submission_polish_abstract,
            submission_generate_cover_letter,
            submission_sync_ccfddl,
            submission_sync_ccfddl_local,
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
            survey_list,
            survey_get,
            survey_delete,
            survey_search,
            translate_text,
            markdown_format_chunk,
            // App lock
            app_lock_status,
            app_lock_set_password,
            app_lock_verify_password,
            app_lock_clear_password,
            app_lock_set_timeout,
            app_lock_get_hint,
            app_lock_get_recovery_info,
            app_lock_set_security,
            app_lock_verify_recovery,
            app_lock_reset_password,
            // Data backup
            data_backup_export,
            data_backup_import,
            webdav_test_connection,
            webdav_list_backups,
            webdav_upload_backup,
            webdav_download_backup,
            webdav_delete_backup,
            // WebDAV 无冲突同步
            sync_configure,
            sync_get_config,
            sync_status,
            sync_now,
            sync_disable,
            // Workbench
            workbench_get_overview_text_cache,
            workbench_generate_overview_text,
            // Writing
            writing_import_image,
            writing_compile_pdf,
            writing_copy_pdf,
            writing_open_compiled_pdf,
            writing_open_mactex_installer,
            writing_open_mactex_download_page,
            // Active Researcher
            active_researcher_scan,
            active_researcher_findings,
            active_researcher_mark_read,
            // Cross-paper Analysis
            papers_cross_analysis,
            // Research Context
            research_context_get_recent_themes,
            research_context_get_theme_context,
            evidence_get_links,
        ])
        .run(tauri::generate_context!());

    match builder {
        Ok(()) => append_diagnostic_log("startup: shutdown clean"),
        Err(error) => append_diagnostic_log(&format!("startup: run error: {error}")),
    }
}
