-- Settings table: persists runtime configuration overrides (key-value)
-- Values here take priority over .env at startup and can be updated via API.

CREATE TABLE IF NOT EXISTS app_settings (
    key         VARCHAR(128) PRIMARY KEY,
    value       TEXT         NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
