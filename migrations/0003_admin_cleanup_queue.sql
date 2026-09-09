CREATE INDEX IF NOT EXISTS idx_works_created_at
ON works(created_at DESC);

CREATE TABLE IF NOT EXISTS asset_cleanup_queue (
  object_key TEXT PRIMARY KEY,
  work_slug TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('delete-work', 'replace-asset')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_cleanup_queue_work_slug
ON asset_cleanup_queue(work_slug);

CREATE INDEX IF NOT EXISTS idx_asset_cleanup_queue_status
ON asset_cleanup_queue(status, updated_at);

PRAGMA optimize;
