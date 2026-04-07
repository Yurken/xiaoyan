use crate::repositories::submission_repository::{
    create_venue, delete_venue, list_venues, toggle_venue_star, update_venue, CreateVenueInput,
    UpdateVenueInput,
};
use crate::state::AppState;
use serde_json::json;
use uuid::Uuid;

pub async fn list_submission_venues(
    state: &AppState,
    search: Option<String>,
    starred_only: Option<bool>,
) -> Result<serde_json::Value, String> {
    let rows = list_venues(&state.db).await?;
    let search_lower = search.as_deref().unwrap_or("").to_lowercase();
    let starred_filter = starred_only.unwrap_or(false);

    let venues = rows
        .into_iter()
        .filter(|row| {
            if starred_filter && !row.starred {
                return false;
            }
            if search_lower.is_empty() {
                return true;
            }

            row.name.to_lowercase().contains(&search_lower)
                || row.full_name.to_lowercase().contains(&search_lower)
        })
        .map(|row| {
            json!({
                "id": row.id,
                "type": row.venue_type,
                "name": row.name,
                "fullName": row.full_name,
                "website": row.website,
                "ccf": row.ccf,
                "area": row.area,
                "starred": row.starred,
                "ei": row.ei,
                "sci": row.sci,
                "sciQuartile": row.sci_quartile,
                "deadline": row.deadline,
                "notificationDate": row.notification_date,
                "specialIssueDeadline": row.special_issue_deadline,
                "specialIssueTitle": row.special_issue_title,
                "createdAt": row.created_at,
            })
        })
        .collect::<Vec<_>>();

    Ok(json!({ "venues": venues }))
}

#[derive(Default)]
pub struct CreateSubmissionVenueParams {
    pub name: String,
    pub full_name: Option<String>,
    pub venue_type: Option<String>,
    pub website: Option<String>,
    pub ccf: Option<String>,
    pub area: Option<String>,
    pub ei: Option<bool>,
    pub sci: Option<bool>,
    pub sci_quartile: Option<String>,
    pub deadline: Option<String>,
    pub notification_date: Option<String>,
    pub special_issue_deadline: Option<String>,
    pub special_issue_title: Option<String>,
}

pub async fn create_submission_venue(
    state: &AppState,
    params: CreateSubmissionVenueParams,
) -> Result<serde_json::Value, String> {
    let id = Uuid::new_v4().to_string();
    let input = CreateVenueInput {
        id: &id,
        venue_type: params.venue_type.as_deref().unwrap_or("conference"),
        name: &params.name,
        full_name: params.full_name.as_deref().unwrap_or(""),
        website: params.website.as_deref().unwrap_or(""),
        ccf: params.ccf.as_deref().unwrap_or(""),
        area: params.area.as_deref().unwrap_or(""),
        ei: params.ei.unwrap_or(false),
        sci: params.sci.unwrap_or(false),
        sci_quartile: params.sci_quartile.as_deref().unwrap_or(""),
        deadline: params.deadline.as_deref(),
        notification_date: params.notification_date.as_deref(),
        special_issue_deadline: params.special_issue_deadline.as_deref(),
        special_issue_title: params.special_issue_title.as_deref().unwrap_or(""),
    };

    create_venue(&state.db, &input).await?;
    Ok(json!({ "id": id }))
}

#[derive(Default)]
pub struct UpdateSubmissionVenueParams {
    pub name: Option<String>,
    pub full_name: Option<String>,
    pub venue_type: Option<String>,
    pub website: Option<String>,
    pub ccf: Option<String>,
    pub area: Option<String>,
    pub ei: Option<bool>,
    pub sci: Option<bool>,
    pub sci_quartile: Option<String>,
    pub deadline: Option<String>,
    pub notification_date: Option<String>,
    pub special_issue_deadline: Option<String>,
    pub special_issue_title: Option<String>,
}

pub async fn update_submission_venue(
    state: &AppState,
    id: &str,
    params: UpdateSubmissionVenueParams,
) -> Result<(), String> {
    let input = UpdateVenueInput {
        name: params.name.as_deref(),
        full_name: params.full_name.as_deref(),
        venue_type: params.venue_type.as_deref(),
        website: params.website.as_deref(),
        ccf: params.ccf.as_deref(),
        area: params.area.as_deref(),
        ei: params.ei,
        sci: params.sci,
        sci_quartile: params.sci_quartile.as_deref(),
        deadline: params.deadline.as_deref(),
        notification_date: params.notification_date.as_deref(),
        special_issue_deadline: params.special_issue_deadline.as_deref(),
        special_issue_title: params.special_issue_title.as_deref(),
    };

    update_venue(&state.db, id, input).await
}

pub async fn delete_submission_venue(state: &AppState, id: &str) -> Result<(), String> {
    delete_venue(&state.db, id).await
}

pub async fn toggle_submission_venue_star(
    state: &AppState,
    id: &str,
) -> Result<(), String> {
    toggle_venue_star(&state.db, id).await
}
