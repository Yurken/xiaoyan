use anyhow::Result;
use sqlx::SqlitePool;

pub async fn ensure_wiki_tables(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS wiki_pages (
            id                   TEXT PRIMARY KEY,
            research_interest_id TEXT NOT NULL REFERENCES research_interests(id) ON DELETE CASCADE,
            slug                 TEXT NOT NULL,
            title                TEXT NOT NULL,
            page_type            TEXT NOT NULL DEFAULT 'concept',
            summary              TEXT NOT NULL DEFAULT '',
            content              TEXT NOT NULL DEFAULT '',
            status               TEXT NOT NULL DEFAULT 'draft',
            confidence           REAL NOT NULL DEFAULT 0,
            current_revision     INTEGER NOT NULL DEFAULT 1,
            source_manifest_hash TEXT NOT NULL DEFAULT '',
            created_at           TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(research_interest_id, slug)
        );

        CREATE TABLE IF NOT EXISTS wiki_page_revisions (
            id               TEXT PRIMARY KEY,
            page_id          TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
            revision_number  INTEGER NOT NULL,
            title            TEXT NOT NULL,
            summary          TEXT NOT NULL DEFAULT '',
            content          TEXT NOT NULL DEFAULT '',
            change_summary   TEXT NOT NULL DEFAULT '',
            generator        TEXT NOT NULL DEFAULT 'manual',
            created_at       TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(page_id, revision_number)
        );

        CREATE TABLE IF NOT EXISTS wiki_page_sources (
            id             TEXT PRIMARY KEY,
            page_id        TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
            revision_id    TEXT REFERENCES wiki_page_revisions(id) ON DELETE SET NULL,
            source_kind    TEXT NOT NULL,
            source_id      TEXT NOT NULL,
            source_title   TEXT NOT NULL DEFAULT '',
            locator        TEXT NOT NULL DEFAULT '',
            relation_kind  TEXT NOT NULL DEFAULT 'supports',
            excerpt        TEXT NOT NULL DEFAULT '',
            created_at     TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(page_id, source_kind, source_id)
        );

        CREATE TABLE IF NOT EXISTS wiki_page_links (
            id             TEXT PRIMARY KEY,
            from_page_id   TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
            to_page_id     TEXT REFERENCES wiki_pages(id) ON DELETE SET NULL,
            target_slug    TEXT NOT NULL,
            relation_kind  TEXT NOT NULL DEFAULT 'related',
            created_at     TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(from_page_id, target_slug, relation_kind)
        );

        CREATE TABLE IF NOT EXISTS wiki_page_chunks (
            id            TEXT PRIMARY KEY,
            page_id       TEXT NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
            revision_id   TEXT REFERENCES wiki_page_revisions(id) ON DELETE CASCADE,
            chunk_index   INTEGER NOT NULL,
            heading_path  TEXT NOT NULL DEFAULT '',
            content       TEXT NOT NULL,
            content_hash  TEXT NOT NULL,
            embedding     TEXT,
            token_count   INTEGER,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(page_id, chunk_index)
        );

        CREATE TABLE IF NOT EXISTS wiki_compile_sources (
            id                   TEXT PRIMARY KEY,
            research_interest_id TEXT NOT NULL REFERENCES research_interests(id) ON DELETE CASCADE,
            source_kind          TEXT NOT NULL,
            source_id            TEXT NOT NULL,
            content_hash         TEXT NOT NULL,
            last_run_id          TEXT,
            last_compiled_at     TEXT NOT NULL DEFAULT (datetime('now')),
            last_error           TEXT,
            updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(research_interest_id, source_kind, source_id)
        );

        CREATE TABLE IF NOT EXISTS wiki_compile_runs (
            id                   TEXT PRIMARY KEY,
            research_interest_id TEXT NOT NULL REFERENCES research_interests(id) ON DELETE CASCADE,
            status               TEXT NOT NULL DEFAULT 'running',
            source_count         INTEGER NOT NULL DEFAULT 0,
            changed_source_count INTEGER NOT NULL DEFAULT 0,
            pages_created        INTEGER NOT NULL DEFAULT 0,
            pages_updated        INTEGER NOT NULL DEFAULT 0,
            issue_count          INTEGER NOT NULL DEFAULT 0,
            source_manifest      TEXT NOT NULL DEFAULT '[]',
            error                TEXT,
            started_at           TEXT NOT NULL DEFAULT (datetime('now')),
            finished_at          TEXT,
            updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS wiki_issues (
            id                   TEXT PRIMARY KEY,
            research_interest_id TEXT NOT NULL REFERENCES research_interests(id) ON DELETE CASCADE,
            page_id              TEXT REFERENCES wiki_pages(id) ON DELETE CASCADE,
            issue_type           TEXT NOT NULL,
            severity             TEXT NOT NULL DEFAULT 'warning',
            message              TEXT NOT NULL,
            status               TEXT NOT NULL DEFAULT 'open',
            created_at           TEXT NOT NULL DEFAULT (datetime('now')),
            resolved_at          TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_wiki_pages_interest_updated
            ON wiki_pages(research_interest_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_wiki_page_sources_page
            ON wiki_page_sources(page_id, source_kind);
        CREATE INDEX IF NOT EXISTS idx_wiki_page_sources_source
            ON wiki_page_sources(source_kind, source_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_page_links_from
            ON wiki_page_links(from_page_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_page_links_to
            ON wiki_page_links(to_page_id);
        CREATE INDEX IF NOT EXISTS idx_wiki_page_chunks_page
            ON wiki_page_chunks(page_id, chunk_index);
        CREATE INDEX IF NOT EXISTS idx_wiki_compile_runs_interest
            ON wiki_compile_runs(research_interest_id, started_at DESC);
        CREATE INDEX IF NOT EXISTS idx_wiki_issues_interest_status
            ON wiki_issues(research_interest_id, status, severity);",
    )
    .execute(pool)
    .await?;
    ensure_column(pool, "wiki_compile_sources", "updated_at").await?;
    ensure_column(pool, "wiki_compile_runs", "updated_at").await?;
    Ok(())
}

async fn ensure_column(pool: &SqlitePool, table: &str, column: &str) -> Result<()> {
    let columns = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await?;
    let exists = columns
        .iter()
        .any(|row| sqlx::Row::get::<String, _>(row, "name") == column);
    if !exists {
        sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {column} TEXT"))
            .execute(pool)
            .await?;
        sqlx::query(&format!(
            "UPDATE {table} SET {column} = datetime('now') WHERE {column} IS NULL OR {column} = ''"
        ))
        .execute(pool)
        .await?;
    }
    Ok(())
}
