CREATE TABLE work_assets_with_gallery (
  object_key TEXT PRIMARY KEY,
  work_slug TEXT NOT NULL REFERENCES works(slug),
  public_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('before', 'after', 'thumbnail', 'gallery', 'gallery-thumbnail')),
  part_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER,
  created_at TEXT NOT NULL
);

INSERT INTO work_assets_with_gallery (
  object_key,
  work_slug,
  public_url,
  kind,
  part_index,
  width,
  height,
  bytes,
  created_at
)
SELECT
  object_key,
  work_slug,
  public_url,
  kind,
  part_index,
  width,
  height,
  bytes,
  created_at
FROM work_assets;

DROP INDEX IF EXISTS idx_work_assets_work_slug;
DROP TABLE work_assets;
ALTER TABLE work_assets_with_gallery RENAME TO work_assets;

CREATE INDEX idx_work_assets_work_slug
ON work_assets(work_slug);

PRAGMA optimize;
