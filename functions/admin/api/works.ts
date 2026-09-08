import {
  isWorkCategory,
  isWorkPart,
  type WorkItem,
  type WorkPart,
} from '../../../content/works/types';
import { getWorkSeoCopy } from '../../../lib/work-seo';
import {
  cleanPublicBase,
  json,
  requireAccess,
  safeSegment,
  type AdminEnv,
} from '../../_shared/admin';

interface AssetReference {
  key: string;
}

interface PartInput {
  part: WorkPart;
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

const makerTerms: Record<string, string> = {
  벤츠: 'mercedes',
  메르세데스벤츠: 'mercedes',
  포르쉐: 'porsche',
  테슬라: 'tesla',
  지프: 'jeep',
  랜드로버: 'land-rover',
  제네시스: 'genesis',
  현대: 'hyundai',
  기아: 'kia',
  아우디: 'audi',
  폭스바겐: 'volkswagen',
  볼보: 'volvo',
  렉서스: 'lexus',
};

const detailTerms: Record<string, string> = {
  전면: 'front',
  후면: 'rear',
  옆면: 'side',
  앞: 'front',
  뒤: 'rear',
  좌측: 'left',
  우측: 'right',
};

const partTerms: Record<string, string> = {
  범퍼: 'bumper',
  도어: 'door',
  휀더: 'fender',
  후드: 'hood',
  트렁크: 'trunk',
  사이드미러: 'side-mirror',
  필러: 'pillar',
  루프: 'roof',
  휠: 'wheel',
};

const modelTerms: Record<string, string> = {
  파나메라: 'panamera',
  레니게이드: 'renegade',
  모델3: 'model3',
  디펜더: 'defender',
};

function required(value: unknown, label: string, maxLength = 5000) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}을(를) 입력하세요.`);
  if (value.trim().length > maxLength) throw new Error(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  return value.trim();
}

function compactKorean(value: string) {
  return value.normalize('NFKC').replace(/[\s·.()_-]/g, '').toLowerCase();
}

function stableFallback(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `item-${(hash >>> 0).toString(36)}`;
}

function slugTerm(value: string, terms: Record<string, string> = {}) {
  const compact = compactKorean(value);
  if (terms[compact]) return terms[compact];
  return safeSegment(value) || stableFallback(value);
}

function baseSlug(input: WorkInput) {
  const first = input.parts[0];
  const part = slugTerm(first.part, partTerms);
  const detailedPart = first.detail
    ? `${slugTerm(first.detail, detailTerms)}-${part}`
    : part;
  return [
    slugTerm(input.carMaker, makerTerms),
    slugTerm(input.carModel, modelTerms),
    detailedPart,
    input.category,
  ].join('-');
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
    'SELECT slug, date, category, updated_at FROM works ORDER BY updated_at DESC LIMIT 20',
  ).all();
  return json({ works: rows.results });
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
      if (!isWorkPart(part.part)) throw new Error(`${index + 1}번 작업 부위를 선택하세요.`);
      return {
        ...part,
        detail: typeof part.detail === 'string' ? part.detail.trim() : '',
        note: required(part.note, `${index + 1}번 부위 설명`, 300),
      };
    });
    input.parts = normalizedParts;

    let slug = baseSlug(input);
    const existing = await env.ACEDENT_DB.prepare('SELECT slug FROM works WHERE slug = ?').bind(slug).first();
    if (existing) slug = `${slug}-${date.replaceAll('-', '')}`;
    const secondExisting = await env.ACEDENT_DB.prepare('SELECT slug FROM works WHERE slug = ?').bind(slug).first();
    if (secondExisting) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;

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
        label: [part.part, part.detail].filter(Boolean).join(' '),
        before: assetUrl(publicBase, before.key),
        after: assetUrl(publicBase, after.key),
        thumbnail: assetUrl(publicBase, thumbnail.key),
        note: part.note,
      });
    }

    const uniqueParts = [...new Set(normalizedParts.map((part) => part.part))];
    const work: WorkItem = {
      slug,
      date,
      title: required(input.title, '제목', 80),
      category,
      part: uniqueParts,
      carMaker: required(input.carMaker, '차량 제조사', 40),
      carModel: required(input.carModel, '차종', 60),
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
    ];
    await env.ACEDENT_DB.batch(statements);

    return json({ work, metadata: getWorkSeoCopy(work) }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '사례 저장에 실패했습니다.' }, 400);
  }
};
