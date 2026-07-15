use sqlx::SqlitePool;

use super::ResearchFieldBriefing;

const BRIEFING_COLUMNS: &str = "id, interest_id, interest_topic, period_start, period_end, summary, trends, key_papers, upcoming_deadlines, generated_at, is_read, stats";

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS research_field_briefings (
            id TEXT PRIMARY KEY,
            interest_id TEXT NOT NULL UNIQUE,
            interest_topic TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            trends TEXT NOT NULL DEFAULT '[]',
            key_papers TEXT NOT NULL DEFAULT '[]',
            upcoming_deadlines TEXT NOT NULL DEFAULT '[]',
            generated_at TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            stats TEXT NOT NULL DEFAULT '{}'
        )",
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    let _ = sqlx::query(
        "ALTER TABLE research_field_briefings ADD COLUMN stats TEXT NOT NULL DEFAULT '{}'",
    )
    .execute(pool)
    .await;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS research_field_briefing_history (
            id TEXT PRIMARY KEY,
            interest_id TEXT NOT NULL,
            interest_topic TEXT NOT NULL,
            period_start TEXT NOT NULL,
            period_end TEXT NOT NULL,
            summary TEXT NOT NULL DEFAULT '',
            trends TEXT NOT NULL DEFAULT '[]',
            key_papers TEXT NOT NULL DEFAULT '[]',
            upcoming_deadlines TEXT NOT NULL DEFAULT '[]',
            generated_at TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            stats TEXT NOT NULL DEFAULT '{}'
        )",
    )
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    for statement in [
        "CREATE INDEX IF NOT EXISTS idx_field_briefings_interest ON research_field_briefings(interest_id)",
        "CREATE INDEX IF NOT EXISTS idx_field_briefings_generated ON research_field_briefings(generated_at DESC)",
        "CREATE INDEX IF NOT EXISTS idx_field_briefing_history_interest_generated ON research_field_briefing_history(interest_id, generated_at DESC)",
    ] {
        let _ = sqlx::query(statement).execute(pool).await;
    }

    let _ = sqlx::query("DROP TABLE IF EXISTS research_field_updates")
        .execute(pool)
        .await;
    Ok(())
}

pub async fn upsert_briefing(
    pool: &SqlitePool,
    briefing: &ResearchFieldBriefing,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO research_field_briefings (
            id, interest_id, interest_topic, period_start, period_end, summary, trends,
            key_papers, upcoming_deadlines, generated_at, is_read, stats
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(interest_id) DO UPDATE SET
            id = excluded.id,
            interest_topic = excluded.interest_topic,
            period_start = excluded.period_start,
            period_end = excluded.period_end,
            summary = excluded.summary,
            trends = excluded.trends,
            key_papers = excluded.key_papers,
            upcoming_deadlines = excluded.upcoming_deadlines,
            generated_at = excluded.generated_at,
            is_read = excluded.is_read,
            stats = excluded.stats",
    )
    .bind(&briefing.id)
    .bind(&briefing.interest_id)
    .bind(&briefing.interest_topic)
    .bind(&briefing.period_start)
    .bind(&briefing.period_end)
    .bind(&briefing.summary)
    .bind(serialize(&briefing.trends))
    .bind(serialize(&briefing.key_papers))
    .bind(serialize(&briefing.upcoming_deadlines))
    .bind(&briefing.generated_at)
    .bind(if briefing.is_read { 1 } else { 0 })
    .bind(serialize(&briefing.stats))
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub async fn append_briefing_history(
    pool: &SqlitePool,
    briefing: &ResearchFieldBriefing,
) -> Result<(), String> {
    sqlx::query(
        "INSERT OR IGNORE INTO research_field_briefing_history (
            id, interest_id, interest_topic, period_start, period_end, summary, trends,
            key_papers, upcoming_deadlines, generated_at, is_read, stats
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&briefing.id)
    .bind(&briefing.interest_id)
    .bind(&briefing.interest_topic)
    .bind(&briefing.period_start)
    .bind(&briefing.period_end)
    .bind(&briefing.summary)
    .bind(serialize(&briefing.trends))
    .bind(serialize(&briefing.key_papers))
    .bind(serialize(&briefing.upcoming_deadlines))
    .bind(&briefing.generated_at)
    .bind(if briefing.is_read { 1 } else { 0 })
    .bind(serialize(&briefing.stats))
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(())
}

pub async fn get_briefings(
    pool: &SqlitePool,
    interest_id: Option<String>,
) -> Result<Vec<ResearchFieldBriefing>, String> {
    let rows = if let Some(interest_id) = interest_id {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(&format!(
            "SELECT {BRIEFING_COLUMNS} FROM research_field_briefings WHERE interest_id = ? ORDER BY generated_at DESC"
        ))
        .bind(interest_id)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(&format!(
            "SELECT {BRIEFING_COLUMNS} FROM research_field_briefings ORDER BY generated_at DESC"
        ))
        .fetch_all(pool)
        .await
    }
    .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(into_briefing).collect())
}

pub async fn get_briefing_history(
    pool: &SqlitePool,
    interest_id: Option<String>,
    limit: i64,
) -> Result<Vec<ResearchFieldBriefing>, String> {
    let limit = limit.clamp(1, 120);
    let rows = if let Some(interest_id) = interest_id {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(&format!(
            "SELECT {BRIEFING_COLUMNS} FROM research_field_briefing_history WHERE interest_id = ? ORDER BY generated_at DESC LIMIT ?"
        ))
        .bind(interest_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, ResearchFieldBriefingRow>(&format!(
            "SELECT {BRIEFING_COLUMNS} FROM research_field_briefing_history ORDER BY generated_at DESC LIMIT ?"
        ))
        .bind(limit)
        .fetch_all(pool)
        .await
    }
    .map_err(|error| error.to_string())?;
    Ok(rows.into_iter().map(into_briefing).collect())
}

pub async fn mark_briefing_read(pool: &SqlitePool, id: Option<String>) -> Result<(), String> {
    if let Some(id) = id {
        sqlx::query("UPDATE research_field_briefings SET is_read = 1 WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    } else {
        sqlx::query("UPDATE research_field_briefings SET is_read = 1")
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub async fn count_unread(pool: &SqlitePool) -> Result<i64, String> {
    let row: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM research_field_briefings WHERE is_read = 0")
            .fetch_one(pool)
            .await
            .map_err(|error| error.to_string())?;
    Ok(row.0)
}

pub async fn get_briefing_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ResearchFieldBriefing>, String> {
    let row = sqlx::query_as::<_, ResearchFieldBriefingRow>(&format!(
        "SELECT {BRIEFING_COLUMNS} FROM research_field_briefings WHERE id = ?
         UNION ALL
         SELECT {BRIEFING_COLUMNS} FROM research_field_briefing_history WHERE id = ?
         LIMIT 1"
    ))
    .bind(id)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;
    Ok(row.map(into_briefing))
}

#[derive(sqlx::FromRow)]
struct ResearchFieldBriefingRow {
    id: String,
    interest_id: String,
    interest_topic: String,
    period_start: String,
    period_end: String,
    summary: String,
    trends: String,
    key_papers: String,
    upcoming_deadlines: String,
    generated_at: String,
    is_read: i32,
    stats: String,
}

fn into_briefing(row: ResearchFieldBriefingRow) -> ResearchFieldBriefing {
    ResearchFieldBriefing {
        id: row.id,
        interest_id: row.interest_id,
        interest_topic: row.interest_topic,
        period_start: row.period_start,
        period_end: row.period_end,
        summary: row.summary,
        trends: serde_json::from_str(&row.trends).unwrap_or_default(),
        key_papers: serde_json::from_str(&row.key_papers).unwrap_or_default(),
        upcoming_deadlines: serde_json::from_str(&row.upcoming_deadlines).unwrap_or_default(),
        generated_at: row.generated_at,
        is_read: row.is_read != 0,
        stats: serde_json::from_str(&row.stats).unwrap_or_default(),
    }
}

fn serialize<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "[]".to_string())
}

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePoolOptions;

    use super::*;
    use crate::services::field_dynamics_service::FieldDynamicsStats;

    fn briefing(
        id: &str,
        generated_at: &str,
        candidate_paper_count: usize,
    ) -> ResearchFieldBriefing {
        ResearchFieldBriefing {
            id: id.to_string(),
            interest_id: "interest-1".to_string(),
            interest_topic: "机器学习".to_string(),
            period_start: "2026-07-01T00:00:00Z".to_string(),
            period_end: generated_at.to_string(),
            summary: "本期摘要".to_string(),
            trends: vec!["检索增强生成".to_string()],
            key_papers: vec![],
            upcoming_deadlines: vec![],
            generated_at: generated_at.to_string(),
            is_read: false,
            stats: FieldDynamicsStats {
                candidate_paper_count,
                selected_paper_count: 0,
                upcoming_deadline_count: 0,
                trend_count: 1,
            },
        }
    }

    #[tokio::test]
    async fn preserves_history_while_replacing_the_current_briefing(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await?;
        ensure_table(&pool).await?;

        let first = briefing("briefing-1", "2026-07-10T08:00:00Z", 4);
        upsert_briefing(&pool, &first).await?;
        append_briefing_history(&pool, &first).await?;

        let second = briefing("briefing-2", "2026-07-11T08:00:00Z", 7);
        upsert_briefing(&pool, &second).await?;
        append_briefing_history(&pool, &second).await?;

        let latest = get_briefings(&pool, Some("interest-1".to_string())).await?;
        assert_eq!(latest.len(), 1);
        assert_eq!(latest[0].id, "briefing-2");
        assert_eq!(latest[0].stats.candidate_paper_count, 7);

        let history = get_briefing_history(&pool, Some("interest-1".to_string()), 24).await?;
        assert_eq!(
            history
                .iter()
                .map(|briefing| briefing.id.as_str())
                .collect::<Vec<_>>(),
            vec!["briefing-2", "briefing-1"]
        );
        assert!(get_briefing_by_id(&pool, "briefing-1").await?.is_some());

        mark_briefing_read(&pool, Some("briefing-2".to_string())).await?;
        assert_eq!(count_unread(&pool).await?, 0);
        assert!(!history[0].is_read);
        Ok(())
    }
}
