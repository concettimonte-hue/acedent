-- Additive only: existing visits and repair cases are untouched. No backfill.
CREATE TABLE IF NOT EXISTS site_visit_sessions (
  session_id TEXT PRIMARY KEY,
  visitor_hash TEXT NOT NULL,
  started_at TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  landing_path TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_site_visit_sessions_date
  ON site_visit_sessions (visit_date);

CREATE INDEX IF NOT EXISTS idx_site_visit_sessions_started
  ON site_visit_sessions (started_at);
