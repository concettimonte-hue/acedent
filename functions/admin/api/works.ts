import {
  isWorkCategory,
  isWorkPart,
  isWorkPartValue,
  WORK_GALLERY_MAX_PER_SCOPE,
  WORK_GALLERY_MAX_TOTAL,
  type WorkAssetKind,
  type WorkCategory,
  type WorkItem,
  type WorkPart,
  type WorkPartValue,
} from '../../../content/works/types';
import { getWorkSeoCopy } from '../../../lib/work-seo';
import {
  cleanPublicBase,
  json,
  requireAccess,
  type AdminEnv,
} from '../../_shared/admin';
import { createWorkSlugAnalysis, nextNumericWorkSlug } from '../../_shared/work-slug';

interface AssetReference {
  key: string;
}

interface GalleryInput {
  image: AssetReference;
  thumbnail: AssetReference;
  caption?: string;
}

interface PartInput {
  part: unknown;
  category?: unknown;
  detail: string;
  note: string;
  before: AssetReference;
  after: AssetReference;
  thumbnail: AssetReference;
  gallery?: unknown;
}

interface WorkInput {
  uploadId: string;
  date: string;
  carMaker: string;
  carModel: string;
  color: string;
  category: string;
  subCategories?: unknown;
  subParts?: unknown;
  days: string;
  title: string;
  summary: string;
  body: string;
  blogUrl?: string;
  parts: PartInput[];
  gallery?: unknown;
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
  const unique = [...new Set(normalized)];
  if (unique.length > 3) throw new Error(`${index + 1}번 사진 묶음의 작업 부위는 최대 3개까지 선택할 수 있습니다.`);
  return unique;
}

function normalizePartCategory(value: unknown, index: number): WorkCategory | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !isWorkCategory(value)) {
    throw new Error(`${index + 1}번 PART 작업 방식이 올바르지 않습니다.`);
  }
  return value;
}

function normalizeSubCategories(value: unknown, category: WorkCategory) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('보조 작업 값이 올바르지 않습니다.');
  const normalized = [...new Set(value.map((item) => {
    if (typeof item !== 'string' || !isWorkCategory(item)) throw new Error('보조 작업 값이 올바르지 않습니다.');
    return item;
  }))];
  if (normalized.length > 2) throw new Error('보조 작업은 최대 2개까지 선택할 수 있습니다.');
  if (normalized.includes(category)) throw new Error('주 카테고리는 보조 작업으로 중복 선택할 수 없습니다.');
  return normalized;
}

function normalizeSubParts(value: unknown, primaryPart: WorkPartValue) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('보조 부위 값이 올바르지 않습니다.');
  const normalized = [...new Set(value.map((item) => {
    if (typeof item !== 'string' || !isWorkPart(item)) throw new Error('보조 부위 값이 올바르지 않습니다.');
    return item as WorkPart;
  }))];
  if (normalized.length > 2) throw new Error('보조 부위는 최대 2개까지 선택할 수 있습니다.');
  if (normalized.includes(primaryPart as WorkPart)) throw new Error('주 부위는 보조 부위로 중복 선택할 수 없습니다.');
  return normalized;
}

function normalizeGallery(value: unknown, label: string): GalleryInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} 값이 올바르지 않습니다.`);
  if (value.length > WORK_GALLERY_MAX_PER_SCOPE) {
    throw new Error(`${label}은(는) 최대 ${WORK_GALLERY_MAX_PER_SCOPE}장까지 등록할 수 있습니다.`);
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`${label} ${index + 1}번 정보가 올바르지 않습니다.`);
    const gallery = item as { image?: AssetReference; thumbnail?: AssetReference; caption?: unknown };
    return {
      image: gallery.image as AssetReference,
      thumbnail: gallery.thumbnail as AssetReference,
      caption: optional(gallery.caption, `${label} ${index + 1}번 설명`, 120) || undefined,
    };
  });
}

function assetUrl(base: string, key: string) {
  if (!/^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(key)) throw new Error('업로드 이미지 경로가 올바르지 않습니다.');
  return `${base}/${key}`;
}

async function verifyAsset(
  env: AdminEnv,
  reference: AssetReference,
  expectedKind: WorkAssetKind,
  uploadId: string,
) {
  if (!reference || typeof reference.key !== 'string') throw new Error('업로드된 이미지 정보가 없습니다.');
  if (!reference.key.startsWith(`works/${uploadId}/`)) throw new Error('현재 등록 건의 이미지가 아닙니다.');
  const object = await env.ACEDENT_IMAGES.head(reference.key);
  if (!object || object.customMetadata?.kind !== expectedKind) throw new Error(`${expectedKind} 이미지 확인에 실패했습니다.`);
  const width = Number(object.customMetadata.width);
  const height = Number(object.customMetadata.height);
  const bytes = Number(object.customMetadata.bytes);
  const validDimensions = expectedKind === 'gallery'
    ? width > 0 && height > 0 && width <= 1600 && height <= 1600
    : expectedKind === 'thumbnail' || expectedKind === 'gallery-thumbnail'
      ? width === 800 && height === 600
      : width === 1600 && height === 1200;
  if (!validDimensions || !Number.isFinite(bytes) || bytes > 200_000) {
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
    const categoryValue = input.category;
    if (!isWorkCategory(categoryValue)) throw new Error('카테고리를 선택하세요.');
    const category = categoryValue as WorkCategory;
    if (!Array.isArray(input.parts) || input.parts.length === 0) throw new Error('작업 부위를 한 개 이상 추가하세요.');

    const normalizedParts = input.parts.map((part, index) => {
      return {
        ...part,
        part: normalizePartValues(part.part, index),
        category: normalizePartCategory(part.category, index),
        detail: typeof part.detail === 'string' ? part.detail.trim() : '',
        note: required(part.note, `${index + 1}번 부위 설명`, 300),
        gallery: normalizeGallery(part.gallery, `${index + 1}번 PART 추가 사진`),
      };
    });
    input.parts = normalizedParts;
    const primaryPart = normalizedParts[0].part[0];
    const subCategories = normalizeSubCategories(input.subCategories, category);
    const subParts = normalizeSubParts(input.subParts, primaryPart);
    const workGallery = normalizeGallery(input.gallery, '사례 전체 추가 사진');
    const totalGalleryImages = workGallery.length + normalizedParts.reduce((count, part) => count + part.gallery.length, 0);
    if (totalGalleryImages > WORK_GALLERY_MAX_TOTAL) {
      throw new Error(`추가 사진은 사례 전체 최대 ${WORK_GALLERY_MAX_TOTAL}장까지 등록할 수 있습니다.`);
    }

    const slugAnalysis = createWorkSlugAnalysis(input);
    const slug = await nextAvailableSlug(env.ACEDENT_DB, slugAnalysis.slug);

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
      const gallery = [];
      for (const item of part.gallery) {
        const [image, galleryThumbnail] = await Promise.all([
          verifyAsset(env, item.image, 'gallery', uploadId),
          verifyAsset(env, item.thumbnail, 'gallery-thumbnail', uploadId),
        ]);
        assets.push(
          { ...image, kind: 'gallery' as const, partIndex: index },
          { ...galleryThumbnail, kind: 'gallery-thumbnail' as const, partIndex: index },
        );
        gallery.push({
          src: assetUrl(publicBase, image.key),
          thumbnail: assetUrl(publicBase, galleryThumbnail.key),
          caption: item.caption,
          width: image.width,
          height: image.height,
        });
      }
      mediaParts.push({
        part: part.part,
        category: part.category,
        label: [part.part.join(' · '), part.detail].filter(Boolean).join(' '),
        before: assetUrl(publicBase, before.key),
        after: assetUrl(publicBase, after.key),
        thumbnail: assetUrl(publicBase, thumbnail.key),
        note: part.note,
        gallery,
      });
    }

    const gallery = [];
    for (const item of workGallery) {
      const [image, galleryThumbnail] = await Promise.all([
        verifyAsset(env, item.image, 'gallery', uploadId),
        verifyAsset(env, item.thumbnail, 'gallery-thumbnail', uploadId),
      ]);
      assets.push(
        { ...image, kind: 'gallery' as const, partIndex: 20 },
        { ...galleryThumbnail, kind: 'gallery-thumbnail' as const, partIndex: 20 },
      );
      gallery.push({
        src: assetUrl(publicBase, image.key),
        thumbnail: assetUrl(publicBase, galleryThumbnail.key),
        caption: item.caption,
        width: image.width,
        height: image.height,
      });
    }

    const work: WorkItem = {
      slug,
      date,
      title: required(input.title, '제목', 80),
      category,
      subCategories,
      part: [primaryPart],
      subParts,
      carMaker: required(input.carMaker, '차량 제조사', 40),
      carModel: optional(input.carModel, '차종', 60),
      color: required(input.color, '색상', 40),
      parts: mediaParts,
      gallery,
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
         (slug, date, category, sub_categories, sub_parts, payload_json, status, created_by_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
      ).bind(
        slug,
        date,
        work.category,
        JSON.stringify(work.subCategories),
        JSON.stringify(work.subParts),
        JSON.stringify(work),
        access.email,
        now,
        now,
      ),
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

    return json({ work, metadata: getWorkSeoCopy(work), slugWarnings: slugAnalysis.excludedTerms }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '사례 저장에 실패했습니다.';
    if (/sub_categories|sub_parts|no column named/i.test(message)) {
      return json({ error: '보조 태그 저장에는 D1 마이그레이션(0005)이 필요합니다.' }, 503);
    }
    if (/CHECK constraint failed.*work_assets|work_assets.*CHECK constraint failed/i.test(message)) {
      return json({ error: '추가 사진 저장에는 D1 마이그레이션(0006)이 필요합니다.' }, 503);
    }
    return json({ error: message }, 400);
  }
};
