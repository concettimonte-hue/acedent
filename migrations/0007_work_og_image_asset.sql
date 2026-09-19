CREATE TABLE work_assets_with_og_image (
  object_key TEXT PRIMARY KEY,
  work_slug TEXT NOT NULL,
  public_url TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('before', 'after', 'thumbnail', 'gallery', 'gallery-thumbnail', 'og-image')),
  part_index INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY (work_slug) REFERENCES works(slug) ON DELETE CASCADE
);

INSERT INTO work_assets_with_og_image (
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
ALTER TABLE work_assets_with_og_image RENAME TO work_assets;

CREATE INDEX idx_work_assets_work_slug
ON work_assets(work_slug);
