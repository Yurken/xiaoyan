use serde_json::json;
use sqlx::{Row, SqlitePool};

const NOTE_COLUMNS: &str =
    "id, title, content, source_type, source_id, tags, research_interest_id, created_at, updated_at";

pub struct UpdateKnowledgeNoteInput {
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
    pub move_interest: bool,
    pub research_interest_id: Option<String>,
}

pub struct UpdatedKnowledgeNote {
    pub value: serde_json::Value,
    pub title: String,
    pub content: String,
    pub research_interest_id: Option<String>,
    pub title_changed: bool,
    pub content_changed: bool,
}

pub fn note_row_to_json(row: &sqlx::sqlite::SqliteRow) -> serde_json::Value {
    let tags = row
        .get::<Option<String>, _>("tags")
        .unwrap_or_else(|| "[]".into());
    json!({
        "id": row.get::<String, _>("id"),
        "title": row.get::<String, _>("title"),
        "content": row.get::<String, _>("content"),
        "source_type": row.get::<String, _>("source_type"),
        "source_id": row.get::<Option<String>, _>("source_id"),
        "tags": serde_json::from_str::<serde_json::Value>(&tags).unwrap_or(json!([])),
        "research_interest_id": row.get::<Option<String>, _>("research_interest_id"),
        "created_at": row.get::<String, _>("created_at"),
        "updated_at": row.get::<String, _>("updated_at"),
    })
}

pub async fn get_knowledge_note(db: &SqlitePool, id: &str) -> Result<serde_json::Value, String> {
    let query = format!("SELECT {NOTE_COLUMNS} FROM knowledge_notes WHERE id = ?");
    let row = sqlx::query(&query)
        .bind(id)
        .fetch_optional(db)
        .await
        .map_err(|error| error.to_string())?
        .ok_or("未找到对应笔记。")?;
    Ok(note_row_to_json(&row))
}

pub async fn update_knowledge_note(
    db: &SqlitePool,
    id: &str,
    input: UpdateKnowledgeNoteInput,
) -> Result<UpdatedKnowledgeNote, String> {
    let select_query = format!("SELECT {NOTE_COLUMNS} FROM knowledge_notes WHERE id = ?");
    let mut transaction = db.begin().await.map_err(|error| error.to_string())?;
    let existing = sqlx::query(&select_query)
        .bind(id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?
        .ok_or("未找到对应笔记。")?;

    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = input
        .tags
        .as_ref()
        .map(|tags| serde_json::to_string(tags).unwrap_or_else(|_| "[]".into()));
    let normalized_interest_id = input.research_interest_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        (!trimmed.is_empty()).then_some(trimmed)
    });

    sqlx::query(
        "UPDATE knowledge_notes
         SET title = COALESCE(?, title),
             content = COALESCE(?, content),
             tags = COALESCE(?, tags),
             research_interest_id = CASE WHEN ? THEN ? ELSE research_interest_id END,
             updated_at = ?
         WHERE id = ?",
    )
    .bind(&input.title)
    .bind(&input.content)
    .bind(&tags_json)
    .bind(input.move_interest)
    .bind(&normalized_interest_id)
    .bind(&now)
    .bind(id)
    .execute(&mut *transaction)
    .await
    .map_err(|error| error.to_string())?;

    let row = sqlx::query(&select_query)
        .bind(id)
        .fetch_one(&mut *transaction)
        .await
        .map_err(|error| error.to_string())?;
    transaction
        .commit()
        .await
        .map_err(|error| error.to_string())?;

    let title = row.get::<String, _>("title");
    let content = row.get::<String, _>("content");
    Ok(UpdatedKnowledgeNote {
        value: note_row_to_json(&row),
        title_changed: input.title.is_some() && title != existing.get::<String, _>("title"),
        content_changed: input.content.is_some() && content != existing.get::<String, _>("content"),
        research_interest_id: row.get::<Option<String>, _>("research_interest_id"),
        title,
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        sqlx::query(
            "CREATE TABLE knowledge_notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source_type TEXT NOT NULL,
                source_id TEXT,
                tags TEXT,
                research_interest_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO knowledge_notes
             (id, title, content, source_type, tags, research_interest_id, created_at, updated_at)
             VALUES ('note-1', '旧标题', '旧正文', 'manual', '[]', 'interest-1', '2026-09-12', '2026-09-12')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    #[tokio::test]
    async fn updates_note_fields_and_interest_in_one_transaction() {
        let pool = test_pool().await;
        let updated = update_knowledge_note(
            &pool,
            "note-1",
            UpdateKnowledgeNoteInput {
                title: Some("新标题".into()),
                content: Some("新正文".into()),
                tags: Some(vec!["方法".into()]),
                move_interest: true,
                research_interest_id: Some("  ".into()),
            },
        )
        .await
        .unwrap();

        assert!(updated.title_changed);
        assert!(updated.content_changed);
        assert_eq!(updated.research_interest_id, None);
        assert_eq!(updated.value["title"], "新标题");
        assert_eq!(updated.value["content"], "新正文");
        assert_eq!(updated.value["tags"], json!(["方法"]));
    }

    #[tokio::test]
    async fn leaves_interest_unchanged_when_move_was_not_requested() {
        let pool = test_pool().await;
        let updated = update_knowledge_note(
            &pool,
            "note-1",
            UpdateKnowledgeNoteInput {
                title: Some("新标题".into()),
                content: None,
                tags: None,
                move_interest: false,
                research_interest_id: None,
            },
        )
        .await
        .unwrap();

        assert_eq!(updated.research_interest_id.as_deref(), Some("interest-1"));
        let fetched = get_knowledge_note(&pool, "note-1").await.unwrap();
        assert_eq!(fetched["research_interest_id"], "interest-1");
    }
}
