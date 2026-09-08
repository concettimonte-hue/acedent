CREATE TABLE IF NOT EXISTS works (
  slug TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_works_status_date
ON works(status, date DESC);

CREATE TABLE IF NOT EXISTS work_assets (
  object_key TEXT PRIMARY KEY,
  work_slug TEXT NOT NULL REFERENCES works(slug),
  public_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('before', 'after', 'thumbnail')),
  part_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_assets_work_slug
ON work_assets(work_slug);

PRAGMA optimize;
