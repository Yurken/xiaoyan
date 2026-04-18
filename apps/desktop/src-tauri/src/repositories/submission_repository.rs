use sqlx::{Row, SqlitePool};

pub struct VenueRow {
    pub id: String,
    pub venue_type: String,
    pub name: String,
    pub full_name: String,
    pub website: String,
    pub ccf: String,
    pub area: String,
    pub starred: bool,
    pub ei: bool,
    pub sci: bool,
    pub sci_quartile: String,
    pub deadline: Option<String>,
    pub notification_date: Option<String>,
    pub special_issue_deadline: Option<String>,
    pub special_issue_title: String,
    pub created_at: String,
}

pub struct CreateVenueInput<'a> {
    pub id: &'a str,
    pub venue_type: &'a str,
    pub name: &'a str,
    pub full_name: &'a str,
    pub website: &'a str,
    pub ccf: &'a str,
    pub area: &'a str,
    pub ei: bool,
    pub sci: bool,
    pub sci_quartile: &'a str,
    pub deadline: Option<&'a str>,
    pub notification_date: Option<&'a str>,
    pub special_issue_deadline: Option<&'a str>,
    pub special_issue_title: &'a str,
}

#[derive(Default)]
pub struct UpdateVenueInput<'a> {
    pub name: Option<&'a str>,
    pub full_name: Option<&'a str>,
    pub venue_type: Option<&'a str>,
    pub website: Option<&'a str>,
    pub ccf: Option<&'a str>,
    pub area: Option<&'a str>,
    pub ei: Option<bool>,
    pub sci: Option<bool>,
    pub sci_quartile: Option<&'a str>,
    pub deadline: Option<&'a str>,
    pub notification_date: Option<&'a str>,
    pub special_issue_deadline: Option<&'a str>,
    pub special_issue_title: Option<&'a str>,
}

pub async fn list_venues(pool: &SqlitePool) -> Result<Vec<VenueRow>, String> {
    let rows = sqlx::query(
        "SELECT id, type, name, full_name, website, ccf, area, starred, ei, sci, sci_quartile,
                deadline, notification_date, special_issue_deadline, special_issue_title, created_at
         FROM venues ORDER BY starred DESC, name ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .into_iter()
        .map(|row| VenueRow {
            id: row.get("id"),
            venue_type: row.get("type"),
            name: row.get("name"),
            full_name: row.get("full_name"),
            website: row.get("website"),
            ccf: row.get("ccf"),
            area: row.get("area"),
            starred: row.get::<i64, _>("starred") == 1,
            ei: row.get::<i64, _>("ei") == 1,
            sci: row.get::<i64, _>("sci") == 1,
            sci_quartile: row.get("sci_quartile"),
            deadline: row.get("deadline"),
            notification_date: row.get("notification_date"),
            special_issue_deadline: row.get("special_issue_deadline"),
            special_issue_title: row.get("special_issue_title"),
            created_at: row.get("created_at"),
        })
        .collect())
}

pub async fn create_venue(pool: &SqlitePool, input: &CreateVenueInput<'_>) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO venues (id, type, name, full_name, website, ccf, area, ei, sci, sci_quartile,
                             deadline, notification_date, special_issue_deadline, special_issue_title)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.id)
    .bind(input.venue_type)
    .bind(input.name)
    .bind(input.full_name)
    .bind(input.website)
    .bind(input.ccf)
    .bind(input.area)
    .bind(input.ei as i64)
    .bind(input.sci as i64)
    .bind(input.sci_quartile)
    .bind(input.deadline)
    .bind(input.notification_date)
    .bind(input.special_issue_deadline)
    .bind(input.special_issue_title)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn update_venue(
    pool: &SqlitePool,
    id: &str,
    input: UpdateVenueInput<'_>,
) -> Result<(), String> {
    if let Some(value) = input.name {
        sqlx::query("UPDATE venues SET name = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.full_name {
        sqlx::query("UPDATE venues SET full_name = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.venue_type {
        sqlx::query("UPDATE venues SET type = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.website {
        sqlx::query("UPDATE venues SET website = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.ccf {
        sqlx::query("UPDATE venues SET ccf = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.area {
        sqlx::query("UPDATE venues SET area = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.ei {
        sqlx::query("UPDATE venues SET ei = ? WHERE id = ?")
            .bind(value as i64)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.sci {
        sqlx::query("UPDATE venues SET sci = ? WHERE id = ?")
            .bind(value as i64)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.sci_quartile {
        sqlx::query("UPDATE venues SET sci_quartile = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.deadline {
        let normalized = if value.is_empty() { None } else { Some(value) };
        sqlx::query("UPDATE venues SET deadline = ? WHERE id = ?")
            .bind(normalized)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.notification_date {
        let normalized = if value.is_empty() { None } else { Some(value) };
        sqlx::query("UPDATE venues SET notification_date = ? WHERE id = ?")
            .bind(normalized)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.special_issue_deadline {
        let normalized = if value.is_empty() { None } else { Some(value) };
        sqlx::query("UPDATE venues SET special_issue_deadline = ? WHERE id = ?")
            .bind(normalized)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(value) = input.special_issue_title {
        sqlx::query("UPDATE venues SET special_issue_title = ? WHERE id = ?")
            .bind(value)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub async fn delete_venue(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM venues WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn toggle_venue_star(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("UPDATE venues SET starred = CASE WHEN starred = 1 THEN 0 ELSE 1 END WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
