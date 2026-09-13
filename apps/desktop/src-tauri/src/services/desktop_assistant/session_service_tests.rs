use sqlx::{Row, SqlitePool};

use super::session_service::{
    AssistantSessionPromotionInput, AssistantSessionPromotionMessage,
    AssistantSessionPromotionSource, AssistantSessionService,
};

async fn setup() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
    sqlx::raw_sql(
        "CREATE TABLE research_interests (id TEXT PRIMARY KEY, topic TEXT NOT NULL);
         CREATE TABLE assistant_capture_sessions (
            id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_app TEXT,
            window_title TEXT, created_at TEXT NOT NULL, user_confirmed INTEGER NOT NULL
         );
         CREATE TABLE chat_sessions (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, context_type TEXT NOT NULL,
            context_id TEXT, tag TEXT NOT NULL, created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
         );
         CREATE TABLE chat_messages (
            id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL,
            content TEXT NOT NULL, sources TEXT, images TEXT, created_at TEXT NOT NULL
         );
         INSERT INTO research_interests VALUES ('theme-1', 'Graph RAG');
         INSERT INTO assistant_capture_sessions VALUES
            ('capture-1', 'clipboard', 'Safari', NULL, '2026-01-01T00:00:00Z', 1),
            ('capture-unconfirmed', 'clipboard', NULL, NULL, '2026-01-01T00:00:00Z', 0);",
    )
    .execute(&pool)
    .await
    .unwrap();
    pool
}

fn input(capture_session_id: &str) -> AssistantSessionPromotionInput {
    AssistantSessionPromotionInput {
        temporary_session_id: "assistant-session-1".to_string(),
        capture_session_id: capture_session_id.to_string(),
        title: None,
        context: "confirmed research context".to_string(),
        include_capture_context: true,
        research_theme_id: Some("theme-1".to_string()),
        messages: vec![
            AssistantSessionPromotionMessage {
                role: "user".to_string(),
                content: "请解读当前内容".to_string(),
                sources: vec![],
            },
            AssistantSessionPromotionMessage {
                role: "assistant".to_string(),
                content: "核心结论".to_string(),
                sources: vec![AssistantSessionPromotionSource {
                    source_type: "paper".to_string(),
                    source_id: "paper-1".to_string(),
                    title: "Graph Retrieval".to_string(),
                    url: None,
                }],
            },
        ],
    }
}

#[tokio::test]
async fn promotion_copies_context_and_messages_into_existing_chat_tables() {
    let pool = setup().await;
    let result = AssistantSessionService::promote(&pool, input("capture-1"))
        .await
        .unwrap();
    assert_eq!(result.conversation_id, "assistant-session-1");
    assert!(!result.already_promoted);

    let session = sqlx::query("SELECT context_type, context_id FROM chat_sessions WHERE id = ?")
        .bind(&result.conversation_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(session.get::<String, _>("context_type"), "interest");
    assert_eq!(session.get::<String, _>("context_id"), "theme-1");
    let messages = sqlx::query(
        "SELECT role, content, sources FROM chat_messages WHERE session_id = ? ORDER BY created_at",
    )
    .bind(&result.conversation_id)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(messages.len(), 3);
    assert!(messages[0]
        .get::<String, _>("content")
        .contains("confirmed research context"));
    assert!(messages[2]
        .get::<Option<String>, _>("sources")
        .unwrap()
        .contains("Graph Retrieval"));
}

#[tokio::test]
async fn promotion_is_idempotent_by_temporary_session_id() {
    let pool = setup().await;
    AssistantSessionService::promote(&pool, input("capture-1"))
        .await
        .unwrap();
    let second = AssistantSessionService::promote(&pool, input("capture-1"))
        .await
        .unwrap();
    assert!(second.already_promoted);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chat_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn promotion_requires_a_confirmed_capture() {
    let pool = setup().await;
    assert!(
        AssistantSessionService::promote(&pool, input("capture-unconfirmed"))
            .await
            .is_err()
    );
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM chat_sessions")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn promotion_excludes_capture_content_after_the_user_removes_it() {
    let pool = setup().await;
    let mut promotion = input("capture-1");
    promotion.include_capture_context = false;
    let result = AssistantSessionService::promote(&pool, promotion)
        .await
        .unwrap();
    let messages =
        sqlx::query("SELECT content FROM chat_messages WHERE session_id = ? ORDER BY created_at")
            .bind(result.conversation_id)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(messages.len(), 2);
    assert!(messages.iter().all(|message| !message
        .get::<String, _>("content")
        .contains("confirmed research context")));
}
