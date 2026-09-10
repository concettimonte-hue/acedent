import {
  isWorkCategory,
  isWorkPartValue,
  type WorkItem,
  type WorkPartValue,
} from '../../../content/works/types';
import { getWorkSeoCopy } from '../../../lib/work-seo';
import {
  cleanPublicBase,
  json,
  requireAccess,
  type AdminEnv,
} from '../../_shared/admin';
import { createBaseWorkSlug, nextNumericWorkSlug } from '../../_shared/work-slug';

interface AssetReference {
  key: string;
}

interface PartInput {
  part: unknown;
  detail: string;
  note: string;
  before: AssetReference;
  after: AssetReference;
  thumbnail: AssetReference;
}

interface WorkInput {
  uploadId: string;
  date: string;
  carMaker: string;
  carModel: string;
  color: string;
  category: string;
  days: string;
  title: string;
  summary: string;
  body: string;
  blogUrl?: string;
  parts: PartInput[];
}

function required(value: unknown, label: string, maxLength = 5000) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}을(를) 입력하세요.`);
  if (value.trim().length > maxLength) throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  return value.trim();
}

function optional(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`${label} 값이 올바르지 않습니다.`);
  if (value.trim().length > maxLength) throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  return value.trim();
}

async function nextAvailableSlug(database: D1Database, base: string) {
  if (!base) throw new Error('사례 주소를 만들 수 없습니다. 차량 제조사와 작업 부위를 확인하세요.');
  const rows = await database.prepare(
    'SELECT slug FROM works WHERE slug = ? OR slug GLOB ?',
  ).bind(base, `${base}-[0-9]*`).all<{ slug: string }>();
  return nextNumericWorkSlug(base, rows.results.map((row) => row.slug));
}

function normalizePartValues(value: unknown, index: number): WorkPartValue[] {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0) throw new Error(`${index + 1}번 작업 부위를 한 개 이상 선택하세요.`);
  const normalized = values.map((part) => {
    if (typeof part !== 'string' || !isWorkPartValue(part)) {
      throw new Error(`${index + 1}번 작업 부위가 올바르지 않습니다.`);
    }
    return part.trim() as WorkPartValue;
  });
  return [...new Set(normalized)];
}

function assetUrl(base: string, key: string) {
  if (!/^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(key)) throw new Error('업로드 이미지 경로가 올바르지 않습니다.');
  return `${base}/${key}`;
}

async function verifyAsset(
  env: AdminEnv,
  reference: AssetReference,
  expectedKind: 'before' | 'after' | 'thumbnail',
  uploadId: string,
) {
  if (!reference || typeof reference.key !== 'string') throw new Error('업로드된 이미지 정보가 없습니다.');
  if (!reference.key.startsWith(`works/${uploadId}/`)) throw new Error('현재 등록 건의 이미지가 아닙니다.');
  const object = await env.ACEDENT_IMAGES.head(reference.key);
  if (!object || object.customMetadata?.kind !== expectedKind) throw new Error(`${expectedKind} 이미지 확인에 실패했습니다.`);
  const expectedWidth = expectedKind === 'thumbnail' ? 800 : 1600;
  const expectedHeight = expectedKind === 'thumbnail' ? 600 : 1200;
  const width = Number(object.customMetadata.width);
  const height = Number(object.customMetadata.height);
  const bytes = Number(object.customMetadata.bytes);
  if (width !== expectedWidth || height !== expectedHeight || !Number.isFinite(bytes) || bytes > 200_000) {
    throw new Error(`${expectedKind} 이미지 규격이 올바르지 않습니다.`);
  }
  return {
    key: reference.key,
    width,
    height,
    bytes,
  };
}

export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB) return json({ error: 'D1 바인딩이 설정되지 않았습니다.' }, 503);

  const rows = await env.ACEDENT_DB.prepare(
    `SELECT slug, date, category, status, payload_json, created_at, updated_at
     FROM works
     ORDER BY created_at DESC, date DESC, slug ASC`,
  ).all();
  let cleanupRows: Array<Record<string, unknown>> = [];
  try {
    const cleanup = await env.ACEDENT_DB.prepare(
      `SELECT work_slug, status, attempts, max_attempts, last_error, updated_at
       FROM asset_cleanup_queue
       WHERE operation = 'delete-work'
       ORDER BY updated_at DESC`,
    ).all();
    cleanupRows = cleanup.results as Array<Record<string, unknown>>;
  } catch {
    // 목록 조회는 정리 대기열 마이그레이션 적용 전에도 사용할 수 있어야 합니다.
    cleanupRows = [];
  }

  const cleanupBySlug = new Map<string, {
    status: 'pending' | 'failed';
    attempts: number;
    maxAttempts: number;
    lastError: string;
    assetCount: number;
  }>();
  for (const row of cleanupRows) {
    const workSlug = String(row.work_slug || '');
    if (!workSlug) continue;
    const current = cleanupBySlug.get(workSlug);
    const status = row.status === 'failed' ? 'failed' : 'pending';
    const attempts = Number(row.attempts) || 0;
    const maxAttempts = Number(row.max_attempts) || 3;
    cleanupBySlug.set(workSlug, {
      status: current?.status === 'failed' || status === 'failed' ? 'failed' : 'pending',
      attempts: Math.max(current?.attempts || 0, attempts),
      maxAttempts: Math.max(current?.maxAttempts || 0, maxAttempts),
      lastError: String(row.last_error || current?.lastError || ''),
      assetCount: (current?.assetCount || 0) + 1,
    });
  }

  const works = rows.results.map((row) => {
    try {
      const work = JSON.parse(String(row.payload_json)) as WorkItem;
      const firstPart = work.parts?.[0];
      return {
        slug: String(row.slug),
        date: String(row.date),
        category: String(row.category),
        status: String(row.status),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        title: work.title,
        carMaker: work.carMaker,
        carModel: work.carModel,
        thumbnail: firstPart?.thumbnail || firstPart?.after || '',
        cleanup: cleanupBySlug.get(String(row.slug)) || null,
      };
    } catch {
      return {
        slug: String(row.slug),
        date: String(row.date),
        category: String(row.category),
        status: String(row.status),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        title: '데이터 확인 필요',
        carMaker: '',
        carModel: '',
        thumbnail: '',
        cleanup: cleanupBySlug.get(String(row.slug)) || null,
      };
    }
  });

  return json({ works, total: works.length });
};

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);

  try {
    const input = (await request.json()) as WorkInput;
    const date = required(input.date, '작업 완료일', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('작업 완료일 형식이 올바르지 않습니다.');
    const uploadId = required(input.uploadId, '업로드 식별자', 64);
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(uploadId)) throw new Error('업로드 식별자가 올바르지 않습니다.');
    const category = input.category;
    if (!isWorkCategory(category)) throw new Error('카테고리를 선택하세요.');
    if (!Array.isArray(input.parts) || input.parts.length === 0) throw new Error('작업 부위를 한 개 이상 추가하세요.');

    const normalizedParts = input.parts.map((part, index) => {
      return {
        ...part,
        part: normalizePartValues(part.part, index),
        detail: typeof part.detail === 'string' ? part.detail.trim() : '',
        note: required(part.note, `${index + 1}번 부위 설명`, 300),
      };
    });
    input.parts = normalizedParts;

    const slug = await nextAvailableSlug(env.ACEDENT_DB, createBaseWorkSlug(input));

    const publicBase = cleanPublicBase(env.R2_PUBLIC_BASE_URL);
    const assets = [];
    const mediaParts = [];
    for (const [index, part] of normalizedParts.entries()) {
      const [before, after, thumbnail] = await Promise.all([
        verifyAsset(env, part.before, 'before', uploadId),
        verifyAsset(env, part.after, 'after', uploadId),
        verifyAsset(env, part.thumbnail, 'thumbnail', uploadId),
      ]);
      assets.push(
        { ...before, kind: 'before', partIndex: index },
        { ...after, kind: 'after', partIndex: index },
        { ...thumbnail, kind: 'thumbnail', partIndex: index },
      );
      mediaParts.push({
        part: part.part,
        label: [part.part.join(' · '), part.detail].filter(Boolean).join(' '),
        before: assetUrl(publicBase, before.key),
        after: assetUrl(publicBase, after.key),
        thumbnail: assetUrl(publicBase, thumbnail.key),
        note: part.note,
      });
    }

    const uniqueParts = [...new Set(normalizedParts.flatMap((part) => part.part))];
    const work: WorkItem = {
      slug,
      date,
      title: required(input.title, '제목', 80),
      category,
      part: uniqueParts,
      carMaker: required(input.carMaker, '차량 제조사', 40),
      carModel: optional(input.carModel, '차종', 60),
      color: required(input.color, '색상', 40),
      parts: mediaParts,
      summary: required(input.summary, '요약', 300),
      body: required(input.body, '상세 설명', 5000),
      blogUrl: input.blogUrl?.trim() || undefined,
      featured: false,
      days: required(input.days, '작업기간', 20),
      sliderType: 'drag',
    };
    if (work.blogUrl && !/^https:\/\//i.test(work.blogUrl)) throw new Error('블로그 링크는 https:// 주소로 입력하세요.');

    const now = new Date().toISOString();
    const statements = [
      env.ACEDENT_DB.prepare(
        `INSERT INTO works
         (slug, date, category, payload_json, status, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'published', ?, ?, ?)`,
      ).bind(slug, date, work.category, JSON.stringify(work), access.email, now, now),
      ...assets.map((asset) =>
        env.ACEDENT_DB.prepare(
          `INSERT INTO work_assets
           (object_key, work_slug, public_url, kind, part_index, width, height, bytes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          asset.key,
          slug,
          assetUrl(publicBase, asset.key),
          asset.kind,
          asset.partIndex,
          asset.width,
          asset.height,
          asset.bytes,
          now,
        ),
      ),
      ...assets.map((asset) =>
        env.ACEDENT_DB.prepare(
          'DELETE FROM asset_cleanup_queue WHERE object_key = ? AND work_slug = ?',
        ).bind(asset.key, `upload-${uploadId}`),
      ),
    ];
    await env.ACEDENT_DB.batch(statements);

    return json({ work, metadata: getWorkSeoCopy(work) }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '사례 저장에 실패했습니다.' }, 400);
  }
};
