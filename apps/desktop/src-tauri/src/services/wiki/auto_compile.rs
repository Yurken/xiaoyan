mod schema;
mod worker;

pub use schema::ensure_auto_compile_schema;
pub use worker::start_auto_compile_worker;

#[cfg(test)]
mod tests {
    use super::{
        ensure_auto_compile_schema,
        worker::{enqueue_existing_interests, retry_delay_secs},
    };
    use anyhow::Result;
    use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

    async fn test_pool() -> Result<SqlitePool> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        sqlx::raw_sql(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE research_interests (id TEXT PRIMARY KEY);
             CREATE TABLE papers (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                abstract TEXT,
                full_text TEXT,
                research_interest_id TEXT REFERENCES research_interests(id) ON DELETE CASCADE
             );
             CREATE TABLE knowledge_notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                research_interest_id TEXT REFERENCES research_interests(id) ON DELETE CASCADE
             );",
        )
        .execute(&pool)
        .await?;
        super::super::schema::ensure_wiki_tables(&pool).await?;
        ensure_auto_compile_schema(&pool).await?;
        sqlx::query("INSERT INTO research_interests (id) VALUES ('interest-1')")
            .execute(&pool)
            .await?;
        Ok(pool)
    }

    #[tokio::test]
    async fn source_triggers_debounce_into_one_interest_job() -> Result<()> {
        let pool = test_pool().await?;
        sqlx::query(
            "INSERT INTO knowledge_notes (id, title, content, research_interest_id)
             VALUES ('note-1', 'First', 'content', 'interest-1')",
        )
        .execute(&pool)
        .await?;
        sqlx::query("UPDATE knowledge_notes SET content = 'changed' WHERE id = 'note-1'")
            .execute(&pool)
            .await?;

        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wiki_compile_queue")
            .fetch_one(&pool)
            .await?;
        let reason: String = sqlx::query_scalar(
            "SELECT reason FROM wiki_compile_queue WHERE research_interest_id = 'interest-1'",
        )
        .fetch_one(&pool)
        .await?;
        assert_eq!(count, 1);
        assert_eq!(reason, "note_changed");

        sqlx::query("DELETE FROM wiki_compile_queue")
            .execute(&pool)
            .await?;
        sqlx::query(
            "INSERT INTO papers (id, title, research_interest_id)
             VALUES ('paper-1', 'Paper', 'interest-1')",
        )
        .execute(&pool)
        .await?;
        let empty_insert_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wiki_compile_queue")
            .fetch_one(&pool)
            .await?;
        assert_eq!(empty_insert_count, 0);

        sqlx::query("UPDATE papers SET full_text = 'parsed text' WHERE id = 'paper-1'")
            .execute(&pool)
            .await?;
        let parsed_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wiki_compile_queue")
            .fetch_one(&pool)
            .await?;
        assert_eq!(parsed_count, 1);
        Ok(())
    }

    #[tokio::test]
    async fn startup_requeues_stale_wiki_even_after_the_last_source_is_gone() -> Result<()> {
        let pool = test_pool().await?;
        sqlx::query(
            "INSERT INTO wiki_pages
             (id, research_interest_id, slug, title, summary, content)
             VALUES ('page-1', 'interest-1', 'stale', 'Stale', 'Summary', 'Body')",
        )
        .execute(&pool)
        .await?;

        enqueue_existing_interests(&pool).await?;
        let reason: String = sqlx::query_scalar(
            "SELECT reason FROM wiki_compile_queue WHERE research_interest_id = 'interest-1'",
        )
        .fetch_one(&pool)
        .await?;
        assert_eq!(reason, "startup_reconcile");
        Ok(())
    }

    #[test]
    fn retry_backoff_is_bounded() {
        assert_eq!(retry_delay_secs(1), 30);
        assert_eq!(retry_delay_secs(2), 60);
        assert_eq!(retry_delay_secs(20), 6 * 60 * 60);
    }
}
