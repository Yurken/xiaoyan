use sqlx::SqlitePool;

pub async fn mark_interest_plan_running(db: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("UPDATE research_interests SET status = 'planning' WHERE id = ?")
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn mark_interest_plan_planned(
    db: &SqlitePool,
    id: &str,
    learning_path: &str,
) -> Result<(), String> {
    sqlx::query("UPDATE research_interests SET learning_path = ?, status = 'planned' WHERE id = ?")
        .bind(learning_path)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn restore_interest_plan_status(db: &SqlitePool, id: &str) -> Result<String, String> {
    let learning_path: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT learning_path FROM research_interests WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(db)
    .await
    .map_err(|e| e.to_string())?
    .flatten();
    let next_status = if learning_path
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false)
    {
        "planned"
    } else {
        "active"
    };

    sqlx::query("UPDATE research_interests SET status = ? WHERE id = ?")
        .bind(next_status)
        .bind(id)
        .execute(db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(next_status.to_string())
}
