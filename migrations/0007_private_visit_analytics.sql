CREATE TABLE IF NOT EXISTS site_visit_daily (
  visitor_hash TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  path TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (visitor_hash, visit_date, path)
);

CREATE INDEX IF NOT EXISTS idx_site_visit_daily_date
  ON site_visit_daily (visit_date);

CREATE INDEX IF NOT EXISTS idx_site_visit_daily_path_date
  ON site_visit_daily (path, visit_date);

PRAGMA optimize;
