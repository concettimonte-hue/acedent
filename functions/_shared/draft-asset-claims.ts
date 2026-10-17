import { type AdminEnv } from './admin';

/** Public cleanup never scans the private bucket; protect copies in progress as well. */
export async function publishingDraftKeys(env: AdminEnv): Promise<string[]> {
  const table = await env.ACEDENT_DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='work_draft_assets'",
  ).first();
  if (!table) {
    if (env.ACEDENT_DRAFT_IMAGES)
      throw new Error('Private draft migration required before cleanup');
    return [];
  }
  const rows = await env.ACEDENT_DB.prepare(
    `SELECT a.public_key FROM work_draft_assets a JOIN work_drafts d ON d.id=a.draft_id WHERE d.state='publishing' AND a.public_key IS NOT NULL`,
  ).all<{ public_key: string }>();
  return rows.results.map((row) => row.public_key);
}
