use anyhow::Result;
use sqlx::SqlitePool;

/// 建立内部 Wiki 的持久化编译队列与数据变更触发器。
///
/// 队列不进入 WebDAV 同步：它是本机可重建的运行时状态。论文、笔记本身同步落库时，
/// SQLite 触发器会在目标设备重新入队。
pub async fn ensure_auto_compile_schema(pool: &SqlitePool) -> Result<()> {
    sqlx::raw_sql(
        "CREATE TABLE IF NOT EXISTS wiki_compile_queue (
            research_interest_id TEXT PRIMARY KEY REFERENCES research_interests(id) ON DELETE CASCADE,
            requested_at        INTEGER NOT NULL,
            not_before          INTEGER NOT NULL,
            reason              TEXT NOT NULL DEFAULT 'source_changed',
            attempt_count       INTEGER NOT NULL DEFAULT 0,
            last_error          TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_wiki_compile_queue_due
            ON wiki_compile_queue(not_before, requested_at);

        DROP TRIGGER IF EXISTS wiki_queue_paper_insert;
        DROP TRIGGER IF EXISTS wiki_queue_paper_update_old;
        DROP TRIGGER IF EXISTS wiki_queue_paper_update_new;
        DROP TRIGGER IF EXISTS wiki_queue_paper_delete;
        DROP TRIGGER IF EXISTS wiki_queue_note_insert;
        DROP TRIGGER IF EXISTS wiki_queue_note_update_old;
        DROP TRIGGER IF EXISTS wiki_queue_note_update_new;
        DROP TRIGGER IF EXISTS wiki_queue_note_delete;

        CREATE TRIGGER wiki_queue_paper_insert
        AFTER INSERT ON papers
        WHEN NEW.research_interest_id IS NOT NULL
          AND trim(NEW.research_interest_id) != ''
          AND trim(COALESCE(NULLIF(NEW.full_text, ''), NULLIF(NEW.abstract, ''), '')) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (NEW.research_interest_id, unixepoch(), unixepoch() + 8, 'paper_inserted', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_paper_update_old
        AFTER UPDATE OF title, abstract, full_text, research_interest_id ON papers
        WHEN OLD.research_interest_id IS NOT NULL
          AND trim(OLD.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (OLD.research_interest_id, unixepoch(), unixepoch() + 8, 'paper_changed', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_paper_update_new
        AFTER UPDATE OF title, abstract, full_text, research_interest_id ON papers
        WHEN NEW.research_interest_id IS NOT NULL
          AND trim(NEW.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (NEW.research_interest_id, unixepoch(), unixepoch() + 8, 'paper_changed', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_paper_delete
        AFTER DELETE ON papers
        WHEN OLD.research_interest_id IS NOT NULL
          AND trim(OLD.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (OLD.research_interest_id, unixepoch(), unixepoch() + 8, 'paper_deleted', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_note_insert
        AFTER INSERT ON knowledge_notes
        WHEN NEW.research_interest_id IS NOT NULL
          AND trim(NEW.research_interest_id) != ''
          AND trim(NEW.content) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (NEW.research_interest_id, unixepoch(), unixepoch() + 8, 'note_inserted', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_note_update_old
        AFTER UPDATE OF title, content, research_interest_id ON knowledge_notes
        WHEN OLD.research_interest_id IS NOT NULL
          AND trim(OLD.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (OLD.research_interest_id, unixepoch(), unixepoch() + 8, 'note_changed', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_note_update_new
        AFTER UPDATE OF title, content, research_interest_id ON knowledge_notes
        WHEN NEW.research_interest_id IS NOT NULL
          AND trim(NEW.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (NEW.research_interest_id, unixepoch(), unixepoch() + 8, 'note_changed', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;

        CREATE TRIGGER wiki_queue_note_delete
        AFTER DELETE ON knowledge_notes
        WHEN OLD.research_interest_id IS NOT NULL
          AND trim(OLD.research_interest_id) != ''
        BEGIN
            INSERT INTO wiki_compile_queue
                (research_interest_id, requested_at, not_before, reason, attempt_count, last_error)
            VALUES
                (OLD.research_interest_id, unixepoch(), unixepoch() + 8, 'note_deleted', 0, NULL)
            ON CONFLICT(research_interest_id) DO UPDATE SET
                requested_at = excluded.requested_at,
                not_before = excluded.not_before,
                reason = excluded.reason,
                attempt_count = 0,
                last_error = NULL;
        END;",
    )
    .execute(pool)
    .await?;
    Ok(())
}
