-- Add only a bounded classification code, not raw URLs, app IDs or user data.
-- Existing sessions remain unclassified; never infer their missing evidence.
ALTER TABLE site_visit_sessions ADD COLUMN source_basis TEXT NOT NULL DEFAULT 'legacy'
  CHECK (source_basis IN (
    'link-tag', 'ad-tag', 'web-referrer', 'app-referrer', 'internal',
    'no-referrer', 'unrecognized-tag', 'unsupported-referrer', 'invalid-referrer', 'legacy'
  ));
