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
    caption    TEXT,
    file_path  TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_papers_research_interest_created_at ON papers(research_interest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_chunks_paper_id_chunk_index ON paper_chunks(paper_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_paper_figures_paper_id_fig_index ON paper_figures(paper_id, fig_index);
"#;

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
    ensure_papers_research_interest_column(&pool).await?;
    ensure_paper_analyses_experiment_results_column(&pool).await?;
    ensure_reproduction_guides_code_repository_column(&pool).await?;
    ensure_papers_importance_color_column(&pool).await?;
    ensure_papers_notes_column(&pool).await?;
    ensure_paper_figures_table(&pool).await?;
    ensure_performance_indexes(&pool).await?;
    ensure_skills_table(&pool).await?;

    Ok(pool)
}

async fn ensure_paper_figures_table(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS paper_figures (
            id         TEXT PRIMARY KEY,
            paper_id   TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
            fig_index  INTEGER NOT NULL,
            caption    TEXT,
            file_path  TEXT NOT NULL,
            created_at TEXT NOT NULL
        );",
    )
    .execute(pool)
    .await?;
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

async fn ensure_papers_importance_color_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(papers)").fetch_all(pool).await?;
    let has = columns.iter().any(|row| { let name: String = sqlx::Row::get(row, "name"); name == "importance_color" });
    if !has {
        sqlx::query("ALTER TABLE papers ADD COLUMN importance_color TEXT NOT NULL DEFAULT ''").execute(pool).await?;
    }
    Ok(())
}

async fn ensure_papers_notes_column(pool: &SqlitePool) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(papers)").fetch_all(pool).await?;
    let has = columns.iter().any(|row| { let name: String = sqlx::Row::get(row, "name"); name == "notes" });
    if !has {
        sqlx::query("ALTER TABLE papers ADD COLUMN notes TEXT").execute(pool).await?;
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
