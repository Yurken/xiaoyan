use anyhow::Result;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::path::Path;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings_history (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_settings_history_created_at ON settings_history(created_at DESC);

CREATE TABLE IF NOT EXISTS papers (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    authors    TEXT,
    abstract   TEXT,
    year       INTEGER,
    venue      TEXT,
    doi        TEXT,
    file_path  TEXT,
    full_text  TEXT,
    research_interest_id TEXT REFERENCES research_interests(id) ON DELETE SET NULL,
    tags               TEXT NOT NULL DEFAULT '[]',
    importance_color   TEXT NOT NULL DEFAULT '',
    notes              TEXT,
    status             TEXT NOT NULL DEFAULT 'uploaded',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_chunks (
    id          TEXT PRIMARY KEY,
    paper_id    TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   TEXT,
    token_count INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_analyses (
    id                TEXT PRIMARY KEY,
    paper_id          TEXT NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    research_question  TEXT,
    core_method        TEXT,
    experiment_design  TEXT,
    experiment_results TEXT,
    innovations        TEXT,
    limitations        TEXT,
    key_conclusions    TEXT,
    raw_analysis       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reproduction_guides (
    id                  TEXT PRIMARY KEY,
    paper_id            TEXT NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    code_repository     TEXT,
    environment_setup   TEXT,
    dependencies        TEXT,
    dataset_preparation TEXT,
    training_process    TEXT,
    inference_process   TEXT,
    evaluation_metrics  TEXT,
    risks_and_notes     TEXT,
    raw_guide           TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS research_interests (
    id            TEXT PRIMARY KEY,
    topic         TEXT NOT NULL,
    folder_name   TEXT,
    keywords      TEXT NOT NULL DEFAULT '[]',
    profile       TEXT,
    learning_path TEXT,
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_notes (
    id                   TEXT PRIMARY KEY,
    research_interest_id TEXT REFERENCES research_interests(id) ON DELETE SET NULL,
    title                TEXT NOT NULL,
    content              TEXT NOT NULL,
    source_type          TEXT NOT NULL DEFAULT 'manual',
    source_id            TEXT,
    tags                 TEXT NOT NULL DEFAULT '[]',
    embedding            TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL DEFAULT 'New Conversation',
    context_type TEXT NOT NULL DEFAULT 'general',
    context_id   TEXT,
    tag          TEXT NOT NULL DEFAULT '0',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,
    content    TEXT NOT NULL,
    sources    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id             TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    request_id     TEXT NOT NULL,
    parent_run_id  TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_name     TEXT NOT NULL,
    step_name      TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    order_index    INTEGER NOT NULL DEFAULT 0,
    input_payload  TEXT,
    output_payload TEXT,
    summary        TEXT,
    error          TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_artifacts (
    id            TEXT PRIMARY KEY,
    run_id        TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS paper_figures (
    id         TEXT PRIMARY KEY,
    paper_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    fig_index  INTEGER NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'figure',
    caption    TEXT,
    file_path  TEXT NOT NULL,
    page_number INTEGER,
    bbox       TEXT,
    source     TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    prompt      TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    is_builtin  INTEGER NOT NULL DEFAULT 0,
    is_enabled  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id_chunk_index ON paper_chunks(paper_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_paper_figures_paper_id_fig_index ON paper_figures(paper_id, fig_index);
"#;

pub const PAPER_PARSE_RUNS_DDL: &str = "
CREATE TABLE IF NOT EXISTS paper_parse_runs (
    id             TEXT PRIMARY KEY,
    paper_id       TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    parser_name    TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'running',
    started_at     TEXT NOT NULL,
    finished_at    TEXT,
    duration_ms    INTEGER,
    text_length    INTEGER NOT NULL DEFAULT 0,
    preview_length INTEGER NOT NULL DEFAULT 0,
    section_count  INTEGER NOT NULL DEFAULT 0,
    figure_count   INTEGER NOT NULL DEFAULT 0,
    fallback_path  TEXT,
    error          TEXT,
    metadata_json  TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_paper_parse_runs_paper_created ON paper_parse_runs(paper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_parse_runs_status ON paper_parse_runs(status);
";

pub const SUBMISSION_DIAGNOSIS_DDL: &str = "
CREATE TABLE IF NOT EXISTS submission_diagnosis_reports (
    id            TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    source        TEXT NOT NULL DEFAULT 'ai_review',
    status        TEXT NOT NULL DEFAULT 'done',
    risk_level    TEXT NOT NULL DEFAULT 'medium',
    summary       TEXT NOT NULL DEFAULT '',
    report_json   TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submission_diagnosis_submission_created
    ON submission_diagnosis_reports(submission_id, created_at DESC);
";

pub const SUBMISSION_REVISION_TASKS_DDL: &str = "
CREATE TABLE IF NOT EXISTS submission_revision_tasks (
    id                  TEXT PRIMARY KEY,
    submission_id       TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    diagnosis_report_id TEXT REFERENCES submission_diagnosis_reports(id) ON DELETE SET NULL,
    checklist_item_id   TEXT REFERENCES submission_checklist(id) ON DELETE SET NULL,
    paper_version_id    TEXT REFERENCES paper_versions(id) ON DELETE SET NULL,
    experiment_id       TEXT REFERENCES experiment_records(id) ON DELETE SET NULL,
    title               TEXT NOT NULL DEFAULT '',
    detail              TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'todo',
    priority            TEXT NOT NULL DEFAULT 'medium',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_submission_revision_tasks_submission_status
    ON submission_revision_tasks(submission_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_submission_revision_tasks_report
    ON submission_revision_tasks(diagnosis_report_id);
CREATE INDEX IF NOT EXISTS idx_submission_revision_tasks_experiment
    ON submission_revision_tasks(experiment_id);
";

// ── Migration: user_memories ──────────────────────────────────────
pub const USER_MEMORIES_DDL: &str = "
CREATE TABLE IF NOT EXISTS user_memories (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL DEFAULT 'auto',
    action     TEXT,
    summary    TEXT NOT NULL,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_memories_type_created ON user_memories(type, created_at DESC);
";

pub const MEMORY_PIPELINE_DDL: &str = "
CREATE TABLE IF NOT EXISTS memory_events (
    id           TEXT PRIMARY KEY,
    session_id   TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
    run_id       TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
    event_type   TEXT NOT NULL,
    source       TEXT NOT NULL,
    summary      TEXT NOT NULL DEFAULT '',
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memory_events_source_created ON memory_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_events_session_created ON memory_events(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS memory_observations (
    id          TEXT PRIMARY KEY,
    event_id    TEXT NOT NULL UNIQUE REFERENCES memory_events(id) ON DELETE CASCADE,
    session_id  TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
    run_id      TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
    source      TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT NOT NULL,
    narrative   TEXT NOT NULL DEFAULT '',
    importance  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memory_observations_created ON memory_observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_observations_source_created ON memory_observations(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_observations_session_created ON memory_observations(session_id, created_at DESC);
";

pub const MEMORY_CHECKPOINT_DDL: &str = "
CREATE TABLE IF NOT EXISTS memory_session_summaries (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    request_id      TEXT,
    context_type    TEXT NOT NULL DEFAULT 'general',
    context_id      TEXT,
    goal            TEXT NOT NULL DEFAULT '',
    summary         TEXT NOT NULL DEFAULT '',
    completed_items TEXT NOT NULL DEFAULT '[]',
    open_questions  TEXT NOT NULL DEFAULT '[]',
    next_steps      TEXT NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'completed',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memory_session_summaries_session_updated ON memory_session_summaries(session_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_session_summaries_context_updated ON memory_session_summaries(context_type, context_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS memory_links (
    id             TEXT PRIMARY KEY,
    checkpoint_id  TEXT REFERENCES memory_session_summaries(id) ON DELETE CASCADE,
    observation_id TEXT REFERENCES memory_observations(id) ON DELETE CASCADE,
    entity_type    TEXT NOT NULL,
    entity_id      TEXT NOT NULL,
    relation       TEXT NOT NULL DEFAULT 'context',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_memory_links_entity ON memory_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_checkpoint ON memory_links(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_observation ON memory_links(observation_id);

CREATE TABLE IF NOT EXISTS active_researcher_findings (
    id              TEXT PRIMARY KEY,
    interest_id     TEXT NOT NULL,
    interest_topic  TEXT NOT NULL,
    arxiv_id        TEXT NOT NULL,
    title           TEXT NOT NULL,
    authors         TEXT NOT NULL DEFAULT '',
    published_at    TEXT NOT NULL DEFAULT '',
    abs_url         TEXT NOT NULL DEFAULT '',
    pdf_url         TEXT NOT NULL DEFAULT '',
    relevance_score INTEGER NOT NULL DEFAULT 0,
    relevance_reason TEXT NOT NULL DEFAULT '',
    abstract_snippet TEXT NOT NULL DEFAULT '',
    scanned_at      TEXT NOT NULL,
    is_read         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_findings_interest ON active_researcher_findings(interest_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_scanned ON active_researcher_findings(scanned_at DESC);
";

pub async fn init_db(app_data_dir: &Path) -> Result<SqlitePool> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("research_copilot.db");

    let opts = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(opts)
        .await?;

    // Run schema – SQLite handles multiple statements via raw_sql
    sqlx::raw_sql(SCHEMA).execute(&pool).await?;
    ensure_research_interest_profile_column(&pool).await?;
    ensure_research_interest_folder_name_column(&pool).await?;
    ensure_research_interest_partial_plan_column(&pool).await?;
    ensure_papers_research_interest_column(&pool).await?;
    ensure_paper_analyses_experiment_results_column(&pool).await?;
    ensure_reproduction_guides_code_repository_column(&pool).await?;
    ensure_papers_importance_color_column(&pool).await?;
    ensure_papers_notes_column(&pool).await?;
    ensure_paper_figures_table(&pool).await?;
    ensure_paper_parse_runs_table(&pool).await?;
    ensure_performance_indexes(&pool).await?;
    ensure_settings_history_table(&pool).await?;
    ensure_skills_table(&pool).await?;
    ensure_user_memories_table(&pool).await?;
    ensure_memory_pipeline_tables(&pool).await?;
    ensure_memory_checkpoint_tables(&pool).await?;
    ensure_submission_tables(&pool).await?;
    ensure_submission_diagnosis_tables(&pool).await?;
    ensure_experiment_tables(&pool).await?;
    ensure_submission_revision_task_tables(&pool).await?;
    ensure_knowledge_graph_tables(&pool).await?;
    reset_stale_research_interest_plans(&pool).await?;

    Ok(pool)
}

async fn reset_stale_research_interest_plans(pool: &SqlitePool) -> Result<()> {
    sqlx::query(
        "UPDATE research_interests
         SET status = CASE
             WHEN learning_path IS NOT NULL AND trim(learning_path) != '' THEN 'planned'
             ELSE 'active'
         END
         WHERE status = 'planning'",
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[allow(dead_code)]
async fn ensure_schema(pool: &SqlitePool) -> Result<()> {
    // Run schema – SQLite handles multiple statements via raw_sql
    sqlx::raw_sql(SCHEMA).execute(pool).await?;
    ensure_research_interest_profile_column(pool).await?;
    ensure_research_interest_folder_name_column(pool).await?;
    ensure_research_interest_partial_plan_column(pool).await?;
    ensure_papers_research_interest_column(pool).await?;
    ensure_paper_analyses_experiment_results_column(pool).await?;
    ensure_reproduction_guides_code_repository_column(pool).await?;
    ensure_papers_importance_color_column(pool).await?;
    ensure_papers_notes_column(pool).await?;
    ensure_paper_figures_table(pool).await?;
    ensure_paper_parse_runs_table(pool).await?;
    ensure_performance_indexes(pool).await?;
    ensure_settings_history_table(pool).await?;
    ensure_skills_table(pool).await?;
    ensure_user_memories_table(pool).await?;
    ensure_memory_pipeline_tables(pool).await?;
    ensure_memory_checkpoint_tables(pool).await?;
    ensure_submission_tables(pool).await?;
    ensure_submission_diagnosis_tables(pool).await?;
    ensure_experiment_tables(pool).await?;
    ensure_submission_revision_task_tables(pool).await?;
    ensure_knowledge_graph_tables(pool).await?;
    Ok(())
}

async fn ensure_paper_figures_table(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS paper_figures (
            id         TEXT PRIMARY KEY,
            paper_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            fig_index  INTEGER NOT NULL,
            kind       TEXT NOT NULL DEFAULT 'figure',
            caption    TEXT,
            file_path  TEXT NOT NULL,
            page_number INTEGER,
            bbox       TEXT,
            source     TEXT,
            created_at TEXT NOT NULL
        );",
    )
    .execute(pool)
    .await?;
    ensure_table_column(
        pool,
        "paper_figures",
        "kind",
        "TEXT NOT NULL DEFAULT 'figure'",
    )
    .await?;
    ensure_table_column(pool, "paper_figures", "page_number", "INTEGER").await?;
    ensure_table_column(pool, "paper_figures", "bbox", "TEXT").await?;
    ensure_table_column(pool, "paper_figures", "source", "TEXT").await?;
    Ok(())
}

async fn ensure_table_column(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    let columns = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await?;
    let has_column = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == column
    });

    if !has_column {
        sqlx::query(&format!(
            "ALTER TABLE {table} ADD COLUMN {column} {definition}"
        ))
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn ensure_paper_parse_runs_table(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(PAPER_PARSE_RUNS_DDL).execute(pool).await?;
    Ok(())
}

async fn ensure_performance_indexes(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at DESC);
         CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);
         CREATE INDEX IF NOT EXISTS idx_papers_research_interest_created_at ON papers(research_interest_id, created_at DESC);
         CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id_chunk_index ON paper_chunks(paper_id, chunk_index);
         CREATE INDEX IF NOT EXISTS idx_paper_figures_paper_id_fig_index ON paper_figures(paper_id, fig_index);",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_settings_history_table(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS settings_history (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            settings_json TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_settings_history_created_at
            ON settings_history(created_at DESC);",
    )
    .execute(pool)
    .await?;
    Ok(())
}

async fn ensure_papers_importance_color_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(papers)")
        .fetch_all(pool)
        .await?;
    let has = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "importance_color"
    });
    if !has {
        sqlx::query("ALTER TABLE papers ADD COLUMN importance_color TEXT NOT NULL DEFAULT ''")
            .execute(pool)
            .await?;
    }
    Ok(())
}

async fn ensure_papers_notes_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(papers)")
        .fetch_all(pool)
        .await?;
    let has = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "notes"
    });
    if !has {
        sqlx::query("ALTER TABLE papers ADD COLUMN notes TEXT")
            .execute(pool)
            .await?;
    }
    Ok(())
}

async fn ensure_reproduction_guides_code_repository_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(reproduction_guides)")
        .fetch_all(pool)
        .await?;

    let has_col = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "code_repository"
    });

    if !has_col {
        sqlx::query("ALTER TABLE reproduction_guides ADD COLUMN code_repository TEXT")
            .execute(pool)
            .await?;
    }

    Ok(())
}

async fn ensure_paper_analyses_experiment_results_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(paper_analyses)")
        .fetch_all(pool)
        .await?;

    let has_col = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "experiment_results"
    });

    if !has_col {
        sqlx::query("ALTER TABLE paper_analyses ADD COLUMN experiment_results TEXT")
            .execute(pool)
            .await?;
    }

    Ok(())
}

async fn ensure_research_interest_profile_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(research_interests)")
        .fetch_all(pool)
        .await?;

    let has_profile = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "profile"
    });

    if !has_profile {
        sqlx::query("ALTER TABLE research_interests ADD COLUMN profile TEXT")
            .execute(pool)
            .await?;
    }

    Ok(())
}

async fn ensure_research_interest_partial_plan_column(pool: &SqlitePool) -> Result<()> {
    ensure_table_column(pool, "research_interests", "partial_plan", "TEXT").await
}

async fn ensure_papers_research_interest_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(papers)")
        .fetch_all(pool)
        .await?;

    let has_research_interest_id = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "research_interest_id"
    });

    if !has_research_interest_id {
        sqlx::query("ALTER TABLE papers ADD COLUMN research_interest_id TEXT")
            .execute(pool)
            .await?;
    }

    Ok(())
}

async fn ensure_research_interest_folder_name_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(research_interests)")
        .fetch_all(pool)
        .await?;

    let has_folder_name = columns.iter().any(|row| {
        let name: String = sqlx::Row::get(row, "name");
        name == "folder_name"
    });

    if !has_folder_name {
        sqlx::query("ALTER TABLE research_interests ADD COLUMN folder_name TEXT")
            .execute(pool)
            .await?;
    }
    sqlx::query("UPDATE research_interests SET folder_name = topic WHERE folder_name IS NULL OR TRIM(folder_name) = ''")
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn ensure_skills_table(pool: &SqlitePool) -> Result<()> {
    // Create table if not exists (already in SCHEMA, this handles upgrades for existing DBs)
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS skills (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL UNIQUE,
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            prompt      TEXT NOT NULL DEFAULT '',
            tags        TEXT NOT NULL DEFAULT '[]',
            is_builtin  INTEGER NOT NULL DEFAULT 0,
            is_enabled  INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .execute(pool)
    .await?;

    // Seed built-in skills (INSERT OR IGNORE so existing customizations are preserved)
    crate::commands::skills::seed_builtin_skills(pool).await?;

    Ok(())
}

pub async fn ensure_user_memories_table(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(USER_MEMORIES_DDL).execute(pool).await?;
    Ok(())
}

pub async fn ensure_memory_pipeline_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(MEMORY_PIPELINE_DDL).execute(pool).await?;
    Ok(())
}

pub async fn ensure_memory_checkpoint_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(MEMORY_CHECKPOINT_DDL).execute(pool).await?;
    Ok(())
}

pub async fn ensure_submission_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS venues (
            id                      TEXT PRIMARY KEY,
            type                    TEXT NOT NULL DEFAULT 'conference',
            name                    TEXT NOT NULL,
            full_name               TEXT NOT NULL DEFAULT '',
            website                 TEXT NOT NULL DEFAULT '',
            ccf                     TEXT NOT NULL DEFAULT '',
            area                    TEXT NOT NULL DEFAULT '',
            starred                 INTEGER NOT NULL DEFAULT 0,
            ei                      INTEGER NOT NULL DEFAULT 0,
            sci                     INTEGER NOT NULL DEFAULT 0,
            sci_quartile            TEXT NOT NULL DEFAULT '',
            deadline                TEXT,
            notification_date       TEXT,
            deadline_timezone       TEXT NOT NULL DEFAULT '',
            conference_date         TEXT NOT NULL DEFAULT '',
            conference_location     TEXT NOT NULL DEFAULT '',
            special_issue_deadline  TEXT,
            special_issue_title     TEXT NOT NULL DEFAULT '',
            created_at              TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS submissions (
            id           TEXT PRIMARY KEY,
            title        TEXT NOT NULL,
            venue_name   TEXT NOT NULL DEFAULT '',
            venue_type   TEXT NOT NULL DEFAULT 'conference',
            status       TEXT NOT NULL DEFAULT 'writing',
            deadline     TEXT,
            submitted_at TEXT,
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS paper_versions (
            id            TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            tag           TEXT NOT NULL DEFAULT '',
            label         TEXT NOT NULL DEFAULT '',
            stage         TEXT NOT NULL DEFAULT 'draft',
            content       TEXT NOT NULL DEFAULT '',
            notes         TEXT NOT NULL DEFAULT '',
            file_path     TEXT,
            file_name     TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS review_rounds (
            id            TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            round         INTEGER NOT NULL DEFAULT 1,
            verdict       TEXT NOT NULL DEFAULT 'pending',
            received_at   TEXT,
            UNIQUE(submission_id, round)
        );
        CREATE TABLE IF NOT EXISTS review_comments (
            id            TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            round         INTEGER NOT NULL DEFAULT 1,
            reviewer      TEXT NOT NULL DEFAULT '',
            content       TEXT NOT NULL DEFAULT '',
            response      TEXT NOT NULL DEFAULT '',
            resolved      INTEGER NOT NULL DEFAULT 0,
            tags          TEXT NOT NULL DEFAULT '[]',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS submission_checklist (
            id            TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            label         TEXT NOT NULL DEFAULT '',
            checked       INTEGER NOT NULL DEFAULT 0,
            category      TEXT NOT NULL DEFAULT '',
            sort_order    INTEGER NOT NULL DEFAULT 0
        );",
    )
    .execute(pool)
    .await?;

    // Migration: add columns that may not exist in older databases
    for column in &[
        "deadline_timezone TEXT NOT NULL DEFAULT ''",
        "conference_date TEXT NOT NULL DEFAULT ''",
        "conference_location TEXT NOT NULL DEFAULT ''",
    ] {
        let sql = format!("ALTER TABLE venues ADD COLUMN {column}");
        let _ = sqlx::raw_sql(&sql).execute(pool).await;
    }

    // Migration: add tag column to chat_sessions
    let _ = sqlx::raw_sql("ALTER TABLE chat_sessions ADD COLUMN tag TEXT NOT NULL DEFAULT '0'")
        .execute(pool)
        .await;

    Ok(())
}

pub async fn ensure_submission_diagnosis_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(SUBMISSION_DIAGNOSIS_DDL)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn ensure_submission_revision_task_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(SUBMISSION_REVISION_TASKS_DDL)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn ensure_experiment_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS experiment_records (
            id                    TEXT PRIMARY KEY,
            title                 TEXT NOT NULL,
            config                TEXT NOT NULL DEFAULT '{}',
            result                TEXT NOT NULL DEFAULT '',
            notes                 TEXT NOT NULL DEFAULT '',
            linked_submission_id  TEXT REFERENCES submissions(id) ON DELETE SET NULL,
            created_at            TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS experiment_attachments (
            id            TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL REFERENCES experiment_records(id) ON DELETE CASCADE,
            file_path     TEXT NOT NULL,
            label         TEXT NOT NULL DEFAULT '',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn ensure_knowledge_graph_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS knowledge_graph_claims (
            id                   TEXT PRIMARY KEY,
            title                TEXT NOT NULL,
            statement            TEXT NOT NULL DEFAULT '',
            research_interest_id TEXT REFERENCES research_interests(id) ON DELETE SET NULL,
            status               TEXT NOT NULL DEFAULT 'supported',
            created_at           TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS knowledge_graph_evidence_links (
            id               TEXT PRIMARY KEY,
            claim_id         TEXT NOT NULL REFERENCES knowledge_graph_claims(id) ON DELETE CASCADE,
            source_kind      TEXT NOT NULL,
            source_id        TEXT NOT NULL,
            relation_kind    TEXT NOT NULL DEFAULT 'supports',
            evidence_summary TEXT NOT NULL DEFAULT '',
            created_at       TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(claim_id, source_kind, source_id, relation_kind)
        );
        CREATE TABLE IF NOT EXISTS knowledge_paper_citations (
            id             TEXT PRIMARY KEY,
            citing_paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            cited_paper_id  TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            context         TEXT,
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(citing_paper_id, cited_paper_id)
        );
        CREATE INDEX IF NOT EXISTS idx_knowledge_graph_claim_interest
            ON knowledge_graph_claims(research_interest_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_knowledge_graph_evidence_claim
            ON knowledge_graph_evidence_links(claim_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_knowledge_graph_evidence_source
            ON knowledge_graph_evidence_links(source_kind, source_id);
        CREATE INDEX IF NOT EXISTS idx_knowledge_paper_citations_citing
            ON knowledge_paper_citations(citing_paper_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_knowledge_paper_citations_cited
            ON knowledge_paper_citations(cited_paper_id, created_at DESC);",
    )
    .execute(pool)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;
    use std::str::FromStr;

    async fn memory_pool() -> Result<SqlitePool> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")?
            .create_if_missing(true)
            .foreign_keys(true);

        Ok(SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?)
    }

    async fn table_exists(pool: &SqlitePool, table: &str) -> Result<bool> {
        let row: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")
                .bind(table)
                .fetch_one(pool)
                .await?;
        Ok(row.0 > 0)
    }

    async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> Result<bool> {
        let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().any(|row| {
            let name: String = row.get("name");
            name == column
        }))
    }

    #[tokio::test]
    async fn schema_upgrade_smoke_adds_040_tables_and_columns() -> Result<()> {
        let pool = memory_pool().await?;

        sqlx::raw_sql(
            "CREATE TABLE research_interests (
                id            TEXT PRIMARY KEY,
                topic         TEXT NOT NULL,
                keywords      TEXT NOT NULL DEFAULT '[]',
                learning_path TEXT,
                status        TEXT NOT NULL DEFAULT 'active',
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE papers (
                id         TEXT PRIMARY KEY,
                title      TEXT NOT NULL,
                authors    TEXT,
                abstract   TEXT,
                year       INTEGER,
                venue      TEXT,
                doi        TEXT,
                file_path  TEXT,
                full_text  TEXT,
                tags       TEXT NOT NULL DEFAULT '[]',
                status     TEXT NOT NULL DEFAULT 'uploaded',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE paper_analyses (
                id                TEXT PRIMARY KEY,
                paper_id          TEXT NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
                research_question TEXT,
                core_method       TEXT,
                experiment_design TEXT,
                innovations       TEXT,
                limitations       TEXT,
                key_conclusions   TEXT,
                raw_analysis      TEXT,
                created_at        TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE reproduction_guides (
                id                  TEXT PRIMARY KEY,
                paper_id            TEXT NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
                environment_setup   TEXT,
                dependencies        TEXT,
                dataset_preparation TEXT,
                training_process    TEXT,
                inference_process   TEXT,
                evaluation_metrics  TEXT,
                risks_and_notes     TEXT,
                raw_guide           TEXT,
                created_at          TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE paper_figures (
                id         TEXT PRIMARY KEY,
                paper_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
                fig_index  INTEGER NOT NULL,
                caption    TEXT,
                file_path  TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE chat_sessions (
                id           TEXT PRIMARY KEY,
                title        TEXT NOT NULL DEFAULT 'New Conversation',
                context_type TEXT NOT NULL DEFAULT 'general',
                context_id   TEXT,
                created_at   TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "INSERT INTO research_interests (id, topic) VALUES ('interest-1', 'Graph RAG')",
        )
        .execute(&pool)
        .await?;

        ensure_schema(&pool).await?;

        for (table, column) in [
            ("research_interests", "profile"),
            ("research_interests", "folder_name"),
            ("papers", "research_interest_id"),
            ("papers", "importance_color"),
            ("papers", "notes"),
            ("paper_analyses", "experiment_results"),
            ("reproduction_guides", "code_repository"),
            ("paper_figures", "kind"),
            ("paper_figures", "page_number"),
            ("paper_figures", "bbox"),
            ("paper_figures", "source"),
            ("chat_sessions", "tag"),
        ] {
            assert!(
                column_exists(&pool, table, column).await?,
                "{table}.{column}"
            );
        }

        for table in [
            "paper_parse_runs",
            "memory_session_summaries",
            "memory_links",
            "submission_diagnosis_reports",
            "submission_revision_tasks",
            "experiment_records",
            "knowledge_graph_claims",
        ] {
            assert!(table_exists(&pool, table).await?, "{table}");
        }

        let folder_name: String = sqlx::query_scalar(
            "SELECT folder_name FROM research_interests WHERE id = 'interest-1'",
        )
        .fetch_one(&pool)
        .await?;
        assert_eq!(folder_name, "Graph RAG");

        Ok(())
    }
}
