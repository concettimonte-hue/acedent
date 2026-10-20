import { json } from '../../_shared/admin';
import type { DraftListRecord } from '../../../lib/draft-list';
import {
  draftHandler,
  draftRecord,
  type DraftRow,
} from '../../_shared/work-drafts';

export const onRequestGet = draftHandler(async (_request, env) => {
  const rows = await env.ACEDENT_DB.prepare(
    `SELECT d.*, w.slug AS published_work_slug
     FROM work_drafts d
     LEFT JOIN works w ON w.slug = d.published_slug AND w.status = 'published'
     ORDER BY d.updated_at DESC`,
  ).all<DraftRow & { published_work_slug: string | null }>();
  return json({
    drafts: await Promise.all(
      rows.results.map(
        async (row): Promise<DraftListRecord> => ({
          ...(await draftRecord(env, row)),
          published_work_slug: row.published_work_slug,
        }),
      ),
    ),
  });
});
