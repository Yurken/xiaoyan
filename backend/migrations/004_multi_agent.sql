-- Multi-agent orchestration persistence

CREATE TABLE IF NOT EXISTS agent_runs (
    id             UUID PRIMARY KEY,
    session_id     UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    request_id     UUID NOT NULL,
    parent_run_id  UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_name     VARCHAR(80) NOT NULL,
    step_name      VARCHAR(200) NOT NULL,
    status         VARCHAR(30) NOT NULL DEFAULT 'pending',
    order_index    INTEGER NOT NULL DEFAULT 0,
    input_payload  JSONB,
    output_payload JSONB,
    summary        TEXT,
    error          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_artifacts (
    id            UUID PRIMARY KEY,
    run_id        UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    artifact_type VARCHAR(80) NOT NULL,
    title         VARCHAR(200) NOT NULL,
    content       TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_session_created
    ON agent_runs(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_runs_request_created
    ON agent_runs(request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run
    ON agent_artifacts(run_id, created_at DESC);
