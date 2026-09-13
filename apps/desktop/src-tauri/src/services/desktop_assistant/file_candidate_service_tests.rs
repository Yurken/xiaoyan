use super::file_candidate_service::*;
use crate::services::desktop_assistant::CleanupService;
use sqlx::SqlitePool;
use std::path::PathBuf;
use uuid::Uuid;

async fn setup() -> (SqlitePool, PathBuf) {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    CleanupService::init_tables(&pool).await.unwrap();
    let directory = std::env::temp_dir().join(format!("xiaoyan-file-candidate-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    (pool, directory)
}

#[tokio::test]
async fn inspects_supported_files_and_rejects_disguised_or_unknown_files() {
    let (pool, directory) = setup().await;
    let pdf = directory.join("paper.pdf");
    let markdown = directory.join("notes.md");
    let png = directory.join("figure.png");
    let webp = directory.join("figure.webp");
    let disguised = directory.join("fake.png");
    let archive = directory.join("archive.zip");
    std::fs::write(&pdf, b"%PDF-1.7\n").unwrap();
    std::fs::write(&markdown, "## 研究笔记").unwrap();
    std::fs::write(&png, [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]).unwrap();
    std::fs::write(
        &webp,
        [b'R', b'I', b'F', b'F', 0, 0, 0, 0, b'W', b'E', b'B', b'P'],
    )
    .unwrap();
    std::fs::write(&disguised, b"not a png").unwrap();
    std::fs::write(&archive, b"PK").unwrap();

    let inspection = FileCandidateService::inspect_and_create(
        &pool,
        vec![
            pdf.to_string_lossy().to_string(),
            markdown.to_string_lossy().to_string(),
            png.to_string_lossy().to_string(),
            webp.to_string_lossy().to_string(),
            disguised.to_string_lossy().to_string(),
            archive.to_string_lossy().to_string(),
        ],
    )
    .await
    .unwrap();

    assert_eq!(inspection.candidates.len(), 4);
    assert_eq!(inspection.candidates[0].recommended_target, "paper");
    assert_eq!(inspection.candidates[1].recommended_target, "note");
    assert_eq!(inspection.candidates[2].recommended_target, "image");
    assert_eq!(inspection.candidates[3].media_type, "image/webp");
    assert_eq!(inspection.rejected.len(), 2);
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn confirm_creates_a_pending_pdf_candidate_and_discard_removes_preview() {
    let (pool, directory) = setup().await;
    let pdf = directory.join("paper.pdf");
    let text = directory.join("notes.txt");
    std::fs::write(&pdf, b"%PDF-1.7\n").unwrap();
    std::fs::write(&text, "research notes").unwrap();
    let inspection = FileCandidateService::inspect_and_create(
        &pool,
        vec![
            pdf.to_string_lossy().to_string(),
            text.to_string_lossy().to_string(),
        ],
    )
    .await
    .unwrap();

    let confirmed = FileCandidateService::confirm(&pool, vec![inspection.candidates[0].id.clone()])
        .await
        .unwrap();
    assert_eq!(confirmed[0].kind, "pdf");
    let paper_path: String = sqlx::query_scalar("SELECT file_path FROM assistant_paper_candidates")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(PathBuf::from(paper_path), pdf.canonicalize().unwrap());

    assert_eq!(
        FileCandidateService::discard(&pool, vec![inspection.candidates[1].id.clone()])
            .await
            .unwrap(),
        1
    );
    std::fs::remove_dir_all(directory).unwrap();
}
