use crate::commands::paper_text::{
    extract_pdf_preview_text, extract_pdf_text_with_filtered_stderr, preview_from_text,
};
use anyhow::Result;
use serde_json::json;
use sqlx::SqlitePool;
use std::path::PathBuf;
use std::time::Instant;
use uuid::Uuid;

const DEFAULT_PREVIEW_PAGES: usize = 3;
const DEFAULT_PREVIEW_CHARS: usize = 12_000;
const DEFAULT_PARSER_NAME: &str = "pdf_extract_lopdf";

#[derive(Debug, Clone)]
pub struct PaperParseResult {
    pub text: String,
    pub preview_text: String,
    pub parser_name: &'static str,
    pub duration_ms: i64,
    pub text_length: i64,
    pub preview_length: i64,
    pub fallback_path: Option<String>,
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn char_count(value: &str) -> i64 {
    value.chars().count() as i64
}

fn estimate_section_count(text: &str) -> i64 {
    text.lines()
        .filter(|line| {
            let trimmed = line.trim();
            if trimmed.len() > 80 {
                return false;
            }

            let lower = trimmed.to_ascii_lowercase();
            matches!(
                lower.as_str(),
                "abstract"
                    | "introduction"
                    | "related work"
                    | "method"
                    | "methods"
                    | "experiments"
                    | "evaluation"
                    | "results"
                    | "conclusion"
                    | "conclusions"
            ) || lower.chars().next().is_some_and(|ch| ch.is_ascii_digit()) && lower.contains('.')
        })
        .count() as i64
}

fn estimate_figure_count(text: &str) -> i64 {
    text.match_indices("Figure ")
        .count()
        .max(text.match_indices("Fig. ").count())
        .max(text.match_indices("Table ").count()) as i64
}

async fn insert_parse_run(
    db: &SqlitePool,
    run_id: &str,
    paper_id: &str,
    started_at: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO paper_parse_runs (
            id, paper_id, parser_name, status, started_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'running', ?, ?, ?)",
    )
    .bind(run_id)
    .bind(paper_id)
    .bind(DEFAULT_PARSER_NAME)
    .bind(started_at)
    .bind(started_at)
    .bind(started_at)
    .execute(db)
    .await?;

    Ok(())
}

async fn finish_parse_run(
    db: &SqlitePool,
    run_id: &str,
    result: &PaperParseResult,
    metadata_json: &str,
) -> Result<()> {
    let finished_at = now_rfc3339();
    sqlx::query(
        "UPDATE paper_parse_runs SET
            status = 'done',
            finished_at = ?,
            duration_ms = ?,
            text_length = ?,
            preview_length = ?,
            section_count = ?,
            figure_count = ?,
            fallback_path = ?,
            metadata_json = ?,
            updated_at = ?
         WHERE id = ?",
    )
    .bind(&finished_at)
    .bind(result.duration_ms)
    .bind(result.text_length)
    .bind(result.preview_length)
    .bind(estimate_section_count(&result.text))
    .bind(estimate_figure_count(&result.text))
    .bind(&result.fallback_path)
    .bind(metadata_json)
    .bind(&finished_at)
    .bind(run_id)
    .execute(db)
    .await?;

    Ok(())
}

async fn fail_parse_run(
    db: &SqlitePool,
    run_id: &str,
    duration_ms: i64,
    error: &str,
) -> Result<()> {
    let finished_at = now_rfc3339();
    sqlx::query(
        "UPDATE paper_parse_runs SET
            status = 'failed',
            finished_at = ?,
            duration_ms = ?,
            error = ?,
            updated_at = ?
         WHERE id = ?",
    )
    .bind(&finished_at)
    .bind(duration_ms)
    .bind(error)
    .bind(&finished_at)
    .bind(run_id)
    .execute(db)
    .await?;

    Ok(())
}

pub async fn parse_pdf_document(
    db: &SqlitePool,
    paper_id: &str,
    path: PathBuf,
) -> Result<PaperParseResult, String> {
    let run_id = Uuid::new_v4().to_string();
    let started_at = now_rfc3339();
    let started = Instant::now();

    insert_parse_run(db, &run_id, paper_id, &started_at)
        .await
        .map_err(|error| error.to_string())?;

    let full_text_path = path.clone();
    let preview_path = path;
    let full_text_handle =
        tokio::task::spawn_blocking(move || extract_pdf_text_with_filtered_stderr(&full_text_path));
    let preview_handle = tokio::task::spawn_blocking(move || {
        extract_pdf_preview_text(&preview_path, DEFAULT_PREVIEW_PAGES, DEFAULT_PREVIEW_CHARS)
    });

    let mut preview_text = preview_handle.await.ok().flatten().unwrap_or_default();

    let text = match full_text_handle.await {
        Ok(Ok(value)) => value,
        Ok(Err(error)) => {
            let _ = fail_parse_run(db, &run_id, started.elapsed().as_millis() as i64, &error).await;
            return Err(format!("PDF 解析失败：{error}"));
        }
        Err(error) => {
            let message = format!("PDF 后台解析任务失败：{error}");
            let _ =
                fail_parse_run(db, &run_id, started.elapsed().as_millis() as i64, &message).await;
            return Err(message);
        }
    };
    if text.trim().is_empty() {
        let message = "PDF 未解析到可用正文，请重新导入或更换可复制文本的 PDF。".to_string();
        let _ = fail_parse_run(db, &run_id, started.elapsed().as_millis() as i64, &message).await;
        return Err(message);
    }

    let fallback_path = if preview_text.trim().is_empty() {
        preview_text = preview_from_text(&text, DEFAULT_PREVIEW_CHARS).unwrap_or_default();
        Some("full_text_preview".to_string())
    } else {
        None
    };

    let result = PaperParseResult {
        text,
        preview_text,
        parser_name: DEFAULT_PARSER_NAME,
        duration_ms: started.elapsed().as_millis() as i64,
        text_length: 0,
        preview_length: 0,
        fallback_path,
    };
    let result = PaperParseResult {
        text_length: char_count(&result.text),
        preview_length: char_count(&result.preview_text),
        ..result
    };
    let metadata = json!({
        "preview_pages": DEFAULT_PREVIEW_PAGES,
        "preview_chars": DEFAULT_PREVIEW_CHARS,
        "fallback_path": &result.fallback_path,
    });
    let metadata_json = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());
    finish_parse_run(db, &run_id, &result, &metadata_json)
        .await
        .map_err(|error| error.to_string())?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{estimate_figure_count, estimate_section_count};

    #[test]
    fn estimates_common_section_headings() {
        let text = "Abstract\nhello\n1. Introduction\nbody\nConclusion";
        assert!(estimate_section_count(text) >= 3);
    }

    #[test]
    fn estimates_figure_or_table_mentions() {
        let text = "Figure 1 shows the architecture. Table 2 lists settings.";
        assert!(estimate_figure_count(text) >= 1);
    }
}
