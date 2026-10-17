-- Additive only. works.status=draft remains the existing deletion state.
CREATE TABLE work_drafts (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'writing' CHECK(state IN ('writing','review','publishing','published','deleting')),
  version INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT NOT NULL DEFAULT '{}',
  publish_json TEXT,
  published_slug TEXT UNIQUE,
  lease_token TEXT,
  lease_until TEXT,
  deploy_state TEXT NOT NULL DEFAULT 'idle',
  deploy_id TEXT,
  deploy_started_at TEXT,
  last_error TEXT,
  created_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_work_drafts_updated ON work_drafts(updated_at DESC);
CREATE TABLE work_draft_assets (
  object_key TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES work_drafts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  part_index INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  ready INTEGER NOT NULL DEFAULT 0,
  public_key TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_work_draft_assets_owner ON work_draft_assets(draft_id);
