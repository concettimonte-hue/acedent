import { json } from '../../../_shared/admin';
import {
  DraftError,
  draftHandler,
  draftRecord,
  normalizeDraft,
  privateBucket,
  readDraft,
  validateDraftReferences,
} from '../../../_shared/work-drafts';

export const onRequestGet = draftHandler(async (_request, env, id) =>
  json(await draftRecord(env, await readDraft(env, id))),
);
export const onRequestPut = draftHandler(async (request, env, id, email) => {
  const body = await request.text();
  if (body.length > 128_000) throw new DraftError('초안 내용이 너무 큽니다.');
  const input = JSON.parse(body);
  const version = input.version;
  if (
    !Number.isInteger(version) ||
    version < 0 ||
    !['writing', 'review'].includes(input.state)
  )
    throw new DraftError('저장 버전과 상태를 확인하세요.');
  const payload = normalizeDraft(input.payload, id);
  const now = new Date().toISOString();
  await validateDraftReferences(env, id, payload);
  const result =
    version === 0
      ? await env.ACEDENT_DB.prepare(
          `INSERT OR IGNORE INTO work_drafts (id,state,version,payload_json,created_by_email,created_at,updated_at) VALUES (?,?,1,?,?,?,?)`,
        )
          .bind(id, input.state, JSON.stringify(payload), email, now, now)
          .run()
      : await env.ACEDENT_DB.prepare(
          `UPDATE work_drafts SET payload_json=?,state=?,version=version+1,updated_at=? WHERE id=? AND version=? AND state IN ('writing','review') AND lease_token IS NULL`,
        )
          .bind(JSON.stringify(payload), input.state, now, id, version)
          .run();
  if (!result.meta.changes)
    throw new DraftError(
      '다른 창에서 변경했거나 발행 중입니다. 현재 입력을 복사해 두고 초안을 다시 여세요.',
      409,
    );
  return json(await draftRecord(env, await readDraft(env, id)));
});
export const onRequestDelete = draftHandler(async (request, env, id) => {
  const { version } = (await request.json()) as { version: number };
  const row = await readDraft(env, id);
  if (
    row.version !== version ||
    !['writing', 'review', 'deleting'].includes(row.state)
  )
    throw new DraftError(
      '발행 중/발행된 초안 또는 변경된 버전은 삭제할 수 없습니다.',
      409,
    );
  const lock = await env.ACEDENT_DB.prepare(
    `UPDATE work_drafts SET state='deleting' WHERE id=? AND version=? AND state IN ('writing','review','deleting') AND lease_token IS NULL`,
  )
    .bind(id, version)
    .run();
  if (!lock.meta.changes)
    throw new DraftError('초안 상태가 바뀌었습니다.', 409);
  const assets = await env.ACEDENT_DB.prepare(
    'SELECT object_key, ready FROM work_draft_assets WHERE draft_id=?',
  )
    .bind(id)
    .all<{ object_key: string; ready: number }>();
  if (assets.results.some((a) => a.ready === 0))
    throw new DraftError(
      '사진 업로드가 진행 중이거나 중단되었습니다. 잠시 후 다시 확인하세요. 계속되면 안전한 삭제를 위해 관리자 점검이 필요합니다. 공개 사진은 변경하지 않았습니다.',
      409,
    );
  if (assets.results.length)
    await privateBucket(env).delete(assets.results.map((a) => a.object_key));
  await env.ACEDENT_DB.prepare(
    `DELETE FROM work_drafts WHERE id=? AND state='deleting' AND version=?`,
  )
    .bind(id, version)
    .run();
  return json({ deleted: true });
});
