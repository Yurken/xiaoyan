-- Phase 2 Migration: users, files, jobs tables
-- Run after init.sql

-- ── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT NOW()
);

-- ── Files (object storage abstraction) ─────────────────────────
CREATE TABLE IF NOT EXISTS files (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    storage_key  TEXT NOT NULL,        -- MinIO object key or local path
    filename     TEXT NOT NULL,
    size_bytes   BIGINT,
    content_type TEXT DEFAULT 'application/pdf',
    backend      TEXT DEFAULT 'local', -- 'local' | 's3'
    created_at   TIMESTAMP DEFAULT NOW()
);

-- ── Jobs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type         TEXT NOT NULL,        -- 'process_paper' | 'analyze_paper' | 'generate_survey'
    status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'done' | 'failed'
    progress     INTEGER DEFAULT 0,    -- 0~100
    payload      JSONB,                -- task input params
    result       JSONB,                -- task output summary
    error        TEXT,                 -- failure reason
    paper_id     UUID REFERENCES papers(id) ON DELETE CASCADE,
    created_at   TIMESTAMP DEFAULT NOW(),
    started_at   TIMESTAMP,
    finished_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_paper_id ON jobs(paper_id);

-- ── Add file_id to papers (optional, keep file_path for compat) ─
ALTER TABLE papers ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES files(id) ON DELETE SET NULL;
