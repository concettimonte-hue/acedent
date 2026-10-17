import { json } from '../../_shared/admin';
import {
  draftHandler,
  draftRecord,
  type DraftRow,
} from '../../_shared/work-drafts';

export const onRequestGet = draftHandler(async (_request, env) => {
  const rows = await env.ACEDENT_DB.prepare(
    'SELECT * FROM work_drafts ORDER BY updated_at DESC',
  ).all<DraftRow>();
  return json({
    drafts: await Promise.all(rows.results.map((row) => draftRecord(env, row))),
  });
});
