import { jpegDimensions, json } from '../../../../_shared/admin';
import {
  DraftError,
  assetResponse,
  draftHandler,
  privateBucket,
  readDraft,
} from '../../../../_shared/work-drafts';
import { type DraftAsset } from '../../../../../lib/work-drafts';

const sizes: Record<string, [number, number] | null> = {
  before: [1600, 1200],
  after: [1600, 1200],
  thumbnail: [800, 600],
  gallery: null,
  'gallery-thumbnail': [800, 600],
  'og-image': [1200, 630],
};
export const onRequestGet = draftHandler(async (request, env, id) => {
  const row = await readDraft(env, id);
  if (row.state === 'deleting')
    throw new DraftError('삭제 중인 초안입니다.', 404);
  const key = new URL(request.url).searchParams.get('key');
  const asset = await env.ACEDENT_DB.prepare(
    'SELECT object_key FROM work_draft_assets WHERE draft_id=? AND object_key=? AND ready=1',
  )
    .bind(id, key)
    .first();
  if (!asset) throw new DraftError('초안 사진을 찾지 못했습니다.', 404);
  const image = await privateBucket(env).get(key!);
  if (!image) throw new DraftError('초안 사진을 찾지 못했습니다.', 404);
  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
});
export const onRequestPost = draftHandler(async (request, env, id) => {
  if (Number(request.headers.get('Content-Length')) > 220_000)
    throw new DraftError('사진은 200KB 이하여야 합니다.');
  const form = await request.formData();
  const file = form.get('file');
  const kind = form.get('kind');
  const partIndex = Number(form.get('partIndex'));
  const assetId = form.get('assetId');
  if (
    !(file instanceof File) ||
    file.type !== 'image/jpeg' ||
    file.size > 200_000 ||
    typeof kind !== 'string' ||
    typeof assetId !== 'string' ||
    !Object.hasOwn(sizes, kind) ||
    !Number.isInteger(partIndex) ||
    partIndex < 0 ||
    partIndex > 20 ||
    !/^[a-f0-9-]{36}$/.test(assetId)
  )
    throw new DraftError('사진 형식·크기·식별자를 확인하세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = jpegDimensions(bytes);
  const expected = sizes[kind];
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    (expected &&
      (dimensions.width !== expected[0] ||
        dimensions.height !== expected[1])) ||
    dimensions.width > 1600 ||
    dimensions.height > 1600
  )
    throw new DraftError('사진 크기를 확인하세요.');
  const key = `works/${id}/${assetId}-${kind}.jpg`;
  const db = env.ACEDENT_DB;
  const prior = await db
    .prepare(
      'SELECT * FROM work_draft_assets WHERE draft_id=? AND object_key=?',
    )
    .bind(id, key)
    .first<DraftAsset>();
  if (prior?.ready === 1) return json(assetResponse(id, prior));
  const row = await readDraft(env, id);
  if (!['writing', 'review'].includes(row.state))
    throw new DraftError('편집 가능한 초안이 아닙니다.', 409);
  if (prior?.ready === 0)
    throw new DraftError(
      '이 사진 업로드를 확인 중입니다. 잠시 뒤 초안을 다시 여세요.',
      409,
    );
  const result = await db
    .prepare(`INSERT INTO work_draft_assets(object_key,draft_id,kind,part_index,width,height,bytes,created_at)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM work_drafts WHERE id=? AND state IN ('writing','review'))
    ON CONFLICT(object_key) DO UPDATE SET ready=0 WHERE work_draft_assets.ready=2`)
    .bind(
      key,
      id,
      kind,
      partIndex,
      dimensions.width,
      dimensions.height,
      file.size,
      new Date().toISOString(),
      id,
    )
    .run();
  if (!result.meta.changes)
    throw new DraftError('초안 상태가 변경되었습니다.', 409);
  try {
    await privateBucket(env).put(key, bytes, {
      httpMetadata: {
        contentType: 'image/jpeg',
        cacheControl: 'private, no-store',
      },
      customMetadata: {
        kind,
        width: String(dimensions.width),
        height: String(dimensions.height),
        bytes: String(file.size),
        uploadId: id,
        partIndex: String(partIndex),
      },
    });
    await db
      .prepare('UPDATE work_draft_assets SET ready=1 WHERE object_key=?')
      .bind(key)
      .run();
  } catch (error) {
    await db
      .prepare('UPDATE work_draft_assets SET ready=2 WHERE object_key=?')
      .bind(key)
      .run();
    throw error;
  }
  return json(
    assetResponse(id, {
      object_key: key,
      kind,
      ...dimensions,
      bytes: file.size,
      ready: 1,
    }),
    201,
  );
});
