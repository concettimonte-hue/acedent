import {
  isWorkCategory,
  isWorkPartValue,
  type WorkAssetKind,
} from '../../content/works/types';
import { parseWorkImageAnnotations } from '../../lib/work-annotations';
import {
  draftImageUrl,
  draftMissing,
  type DraftAsset,
  type DraftPayload,
  type DraftRecord,
} from '../../lib/work-drafts';
import { json, requireAccess, type AdminEnv } from './admin';

export class DraftError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface DraftRow {
  id: string;
  state: DraftRecord['state'];
  version: number;
  payload_json: string;
  publish_json: string | null;
  published_slug: string | null;
  lease_token: string | null;
  lease_until: string | null;
  deploy_state: string;
  deploy_id: string | null;
  deploy_started_at: string | null;
  last_error: string | null;
  updated_at: string;
}
export function privateBucket(env: AdminEnv) {
  if (
    !env.ACEDENT_DRAFT_IMAGES ||
    env.ACEDENT_DRAFT_IMAGES === env.ACEDENT_IMAGES
  )
    throw new DraftError(
      '비공개 초안 버킷 ACEDENT_DRAFT_IMAGES 설정이 필요합니다. 공개 버킷은 사용할 수 없습니다.',
      503,
    );
  return env.ACEDENT_DRAFT_IMAGES;
}
export function draftId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(value))
    throw new DraftError('초안 ID가 올바르지 않습니다.');
  return value;
}
export async function readDraft(env: AdminEnv, id: string) {
  const row = await env.ACEDENT_DB.prepare(
    'SELECT * FROM work_drafts WHERE id = ?',
  )
    .bind(id)
    .first<DraftRow>();
  if (!row) throw new DraftError('초안을 찾지 못했습니다.', 404);
  return row;
}
export async function draftRecord(
  env: AdminEnv,
  row: DraftRow,
): Promise<DraftRecord> {
  const payload = JSON.parse(row.payload_json) as DraftPayload;
  const assets = await env.ACEDENT_DB.prepare(
    'SELECT object_key, kind, width, height, bytes, ready FROM work_draft_assets WHERE draft_id = ?',
  )
    .bind(row.id)
    .all<DraftAsset>();
  return {
    id: row.id,
    state: row.state,
    version: row.version,
    payload,
    assets: assets.results,
    missing: draftMissing(payload),
    updated_at: row.updated_at,
    published_slug: row.published_slug,
    deploy_state: row.deploy_state,
    deploy_id: row.deploy_id,
    last_error: row.last_error,
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new DraftError('입력 형식을 확인하세요.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max)
    throw new DraftError(`텍스트는 ${max}자 이내로 입력하세요.`);
  return value;
}
function array(value: unknown, max: number): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max)
    throw new DraftError(`항목 수는 ${max}개 이하여야 합니다.`);
  return value;
}
export function normalizeDraft(value: unknown, id: string): DraftPayload {
  const p = object(value);
  const image = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const key = object(value).key;
    if (
      typeof key !== 'string' ||
      !key.startsWith(`works/${id}/`) ||
      !/^works\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.jpg$/.test(key)
    )
      throw new DraftError(
        '다른 초안 또는 공개 이미지 주소를 저장할 수 없습니다.',
      );
    return { key };
  };
  const category = (v: unknown) => {
    if (!v) return undefined;
    if (!isWorkCategory(v as string))
      throw new DraftError('작업 분류를 확인하세요.');
    return v as DraftPayload['subCategories'][number];
  };
  const partValues = (v: unknown, max: number) => [
    ...new Set(
      array(v, max).map((item) => {
        if (typeof item !== 'string' || !isWorkPartValue(item))
          throw new DraftError('부위 값을 확인하세요.');
        return item;
      }),
    ),
  ];
  const gallery = (v: unknown) =>
    array(v, 6).map((item) => {
      const g = object(item);
      return {
        image: image(g.image),
        thumbnail: image(g.thumbnail),
        caption: text(g.caption, 120),
      };
    });
  const parts = array(p.parts, 20).map((item) => {
    const s = object(item);
    if (s.position && s.position !== 'front' && s.position !== 'rear')
      throw new DraftError('앞뒤 위치를 확인하세요.');
    return {
      part: partValues(s.part, 3),
      position: s.position as 'front' | 'rear' | undefined,
      category: category(s.category),
      detail: text(s.detail, 80),
      note: text(s.note, 300),
      before: image(s.before),
      after: image(s.after),
      thumbnail: image(s.thumbnail),
      beforeAnnotations: parseWorkImageAnnotations(s.beforeAnnotations),
      gallery: gallery(s.gallery),
      comparisons: array(s.comparisons, 3).map((item) => {
        const pair = object(item);
        return {
          before: image(pair.before),
          after: image(pair.after),
          caption: text(pair.caption, 120),
          beforeAnnotations: parseWorkImageAnnotations(pair.beforeAnnotations),
        };
      }),
    };
  });
  const globalGallery = gallery(p.gallery);
  if (
    parts.reduce((sum, part) => sum + part.comparisons.length, 0) > 6 ||
    parts.reduce(
      (sum, part) => sum + part.gallery.length,
      globalGallery.length,
    ) > 12
  )
    throw new DraftError(
      '추가 비교는 전체 6쌍, 추가 사진은 전체 12장까지 저장할 수 있습니다.',
    );
  return {
    date: text(p.date, 10),
    carMaker: text(p.carMaker, 40),
    carModel: text(p.carModel, 60),
    color: text(p.color, 40),
    category: category(p.category) ?? '',
    days: text(p.days, 20),
    title: text(p.title, 80),
    summary: text(p.summary, 300),
    body: text(p.body, 5000),
    blogUrl: text(p.blogUrl, 2000),
    subCategories: array(p.subCategories, 2).map((v) => {
      const c = category(v);
      if (!c) throw new DraftError('보조 작업을 확인하세요.');
      return c;
    }),
    subParts: partValues(p.subParts, 2),
    parts,
    gallery: globalGallery,
    ogImage: image(p.ogImage),
  };
}
export function draftReferences(p: DraftPayload) {
  const refs: { key: string; kind: WorkAssetKind }[] = [];
  const add = (image: { key: string } | undefined, kind: WorkAssetKind) => {
    if (image) refs.push({ key: image.key, kind });
  };
  const gallery = (items: DraftPayload['gallery']) =>
    items.forEach((g) => {
      add(g.image, 'gallery');
      add(g.thumbnail, 'gallery-thumbnail');
    });
  p.parts.forEach((part) => {
    add(part.before, 'before');
    add(part.after, 'after');
    add(part.thumbnail, 'thumbnail');
    gallery(part.gallery);
    part.comparisons.forEach((pair) => {
      add(pair.before, 'before');
      add(pair.after, 'after');
    });
  });
  gallery(p.gallery);
  add(p.ogImage, 'og-image');
  return refs;
}
export async function validateDraftReferences(
  env: AdminEnv,
  id: string,
  p: DraftPayload,
) {
  const rows = await env.ACEDENT_DB.prepare(
    'SELECT object_key, kind, ready FROM work_draft_assets WHERE draft_id = ?',
  )
    .bind(id)
    .all<DraftAsset>();
  const assets = new Map(rows.results.map((row) => [row.object_key, row]));
  for (const ref of draftReferences(p)) {
    const asset = assets.get(ref.key);
    if (asset?.ready !== 1 || asset.kind !== ref.kind)
      throw new DraftError(
        '초안 사진 저장이 완료되지 않았거나 종류가 맞지 않습니다.',
      );
  }
}
export const assetResponse = (id: string, asset: DraftAsset) => ({
  key: asset.object_key,
  url: draftImageUrl(id, asset.object_key),
  width: asset.width,
  height: asset.height,
  bytes: asset.bytes,
});
export function draftHandler(
  handler: (
    request: Request,
    env: AdminEnv,
    id: string,
    email: string,
  ) => Promise<Response>,
): PagesFunction<AdminEnv> {
  return async ({ request, env, params }) => {
    const access = await requireAccess(request, env);
    if (!access.ok) return access.response;
    if (
      request.method !== 'GET' &&
      request.headers.get('Origin') !== new URL(request.url).origin
    )
      return json(
        { error: '동일 사이트에서만 초안을 변경할 수 있습니다.' },
        403,
      );
    try {
      privateBucket(env);
      if (!env.ACEDENT_DB) throw new DraftError('D1 설정이 필요합니다.', 503);
      return await handler(
        request,
        env,
        params.id ? draftId(params.id) : '',
        access.email,
      );
    } catch (error) {
      if (error instanceof DraftError)
        return json({ error: error.message }, error.status);
      // Never expose SQL, credentials, stored content or upstream response bodies.
      return json(
        {
          error:
            '초안 처리에 실패했습니다. 저장 내용은 유지됩니다. 비공개 버킷과 0008 마이그레이션 설정을 확인하세요.',
        },
        503,
      );
    }
  };
}
