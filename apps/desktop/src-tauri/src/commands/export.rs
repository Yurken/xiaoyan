use crate::state::AppState;
use serde_json::json;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tauri::State;

fn sanitize_file_stem(name: &str) -> String {
    let trimmed = name.trim();
    let normalized = if trimmed.is_empty() {
        "Untitled"
    } else {
        trimmed
    };
    normalized
        .chars()
        .map(|c| if r#"\/:*?\"<>|"#.contains(c) { '_' } else { c })
        .collect::<String>()
}

fn unique_markdown_path(dir: &Path, base_stem: &str) -> PathBuf {
    let mut index = 1usize;
    loop {
        let candidate_name = if index == 1 {
            format!("{}.md", base_stem)
        } else {
            format!("{}-{}.md", base_stem, index)
        };
        let candidate = dir.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

#[tauri::command]
pub async fn export_to_obsidian(
    state: State<'_, AppState>,
    vault_path: String,
) -> Result<serde_json::Value, String> {
    let vault = Path::new(&vault_path);
    if !vault.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }

    let rc_dir = vault.join("ResearchCopilot");
    let notes_dir = rc_dir.join("Notes");
    let papers_dir = rc_dir.join("Papers");

    std::fs::create_dir_all(&notes_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&papers_dir).map_err(|e| e.to_string())?;

    // Export knowledge notes
    let note_rows = sqlx::query(
        "SELECT kn.title, kn.content, kn.created_at, ri.topic as interest_topic
         FROM knowledge_notes kn
         LEFT JOIN research_interests ri ON kn.research_interest_id = ri.id
         ORDER BY kn.created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut notes_count = 0usize;
    for row in &note_rows {
        let title: String = row.get("title");
        let content: String = row.get("content");
        let created_at: String = row.get("created_at");
        let interest: Option<String> = row.get("interest_topic");

        let safe_title = sanitize_file_stem(&title);

        let frontmatter = format!(
            "---\ntitle: \"{}\"\ncreated: {}\n{}\n---\n\n",
            title,
            created_at,
            interest
                .as_deref()
                .map(|t| format!("interest: \"{}\"", t))
                .unwrap_or_default()
        );
        let md_content = format!("{}{}", frontmatter, content);
        let file_path = unique_markdown_path(&notes_dir, &safe_title);
        std::fs::write(&file_path, md_content).map_err(|e| e.to_string())?;
        notes_count += 1;
    }

    // Export paper analyses
    let paper_rows = sqlx::query(
        "SELECT p.title, p.authors, p.year, p.venue, pa.summary, pa.key_contributions, pa.methodology, pa.limitations
         FROM papers p
         LEFT JOIN paper_analyses pa ON pa.paper_id = p.id
         WHERE pa.summary IS NOT NULL AND pa.summary != ''
         ORDER BY p.created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let mut papers_count = 0usize;
    for row in &paper_rows {
        let title: String = row.get("title");
        let authors: Option<String> = row.get("authors");
        let year: Option<i64> = row.get("year");
        let venue: Option<String> = row.get("venue");
        let summary: String = row.get("summary");
        let contributions: Option<String> = row.get("key_contributions");
        let methodology: Option<String> = row.get("methodology");
        let limitations: Option<String> = row.get("limitations");

        let safe_title = sanitize_file_stem(&title);

        let mut md = format!(
            "---\ntitle: \"{}\"\nauthors: \"{}\"\nyear: {}\nvenue: \"{}\"\n---\n\n",
            title,
            authors.as_deref().unwrap_or(""),
            year.unwrap_or(0),
            venue.as_deref().unwrap_or(""),
        );

        md.push_str(&format!("## Summary\n\n{}\n\n", summary));
        if let Some(c) = &contributions {
            if !c.is_empty() {
                md.push_str(&format!("## Key Contributions\n\n{}\n\n", c));
            }
        }
        if let Some(m) = &methodology {
            if !m.is_empty() {
                md.push_str(&format!("## Methodology\n\n{}\n\n", m));
            }
        }
        if let Some(l) = &limitations {
            if !l.is_empty() {
                md.push_str(&format!("## Limitations\n\n{}\n\n", l));
            }
        }

        let file_path = unique_markdown_path(&papers_dir, &safe_title);
        std::fs::write(&file_path, md).map_err(|e| e.to_string())?;
        papers_count += 1;
    }

    Ok(json!({
        "notes": notes_count,
        "papers": papers_count,
        "exportPath": rc_dir.to_string_lossy(),
    }))
}
