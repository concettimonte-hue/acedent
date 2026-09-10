import {
  isWorkCategory,
  isWorkPartValue,
  type WorkItem,
  type WorkPartValue,
} from '../../content/works/types';
import { getWorkSeoCopy } from '../../lib/work-seo';
import { cleanPublicBase, json, type AdminEnv } from './admin';

interface AssetRow {
  object_key: string;
  public_url: string;
  kind: 'before' | 'after' | 'thumbnail';
  part_index: number;
  width: number;
  height: number;
  bytes: number | null;
  created_at: string;
}

interface AssetReference {
  key?: unknown;
}

interface PartInput {
  part?: unknown;
  detail?: unknown;
  label?: unknown;
  note?: unknown;
  before?: AssetReference;
  after?: AssetReference;
  thumbnail?: AssetReference;
}

interface UpdateInput {
  uploadId?: unknown;
  date?: unknown;
  carMaker?: unknown;
  carModel?: unknown;
  color?: unknown;
  category?: unknown;
  days?: unknown;
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  blogUrl?: unknown;
  parts?: unknown;
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

function assetUrl(base: string, key: string) {
  if (!/^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(key)) throw new Error('업로드 이미지 경로가 올바르지 않습니다.');
  return `${base}/${key}`;
}

function readAssetKey(reference: AssetReference | undefined, label: string) {
  const key = reference?.key;
  if (typeof key !== 'string' || !/^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(key)) {
    throw new Error(`${label} 이미지 정보가 올바르지 않습니다.`);
  }
  return key;
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

async function verifyAsset(
  env: AdminEnv,
  currentAssets: Map<string, AssetRow>,
  reference: AssetReference | undefined,
  expectedKind: AssetRow['kind'],
  uploadId: string,
) {
  const key = readAssetKey(reference, expectedKind);
  const current = currentAssets.get(key);
  if (current) {
    const matches = current.kind === expectedKind || (expectedKind === 'thumbnail' && current.kind === 'after');
    if (!matches) throw new Error(`${expectedKind} 이미지 종류가 올바르지 않습니다.`);
    return current;
  }
  if (!uploadId || !key.startsWith(`works/${uploadId}/`)) {
    throw new Error('현재 수정 건에서 업로드한 이미지가 아닙니다.');
  }

  const object = await env.ACEDENT_IMAGES.head(key);
  if (!object || object.customMetadata?.kind !== expectedKind) {
    throw new Error(`${expectedKind} 이미지 확인에 실패했습니다.`);
  }
  const expectedWidth = expectedKind === 'thumbnail' ? 800 : 1600;
  const expectedHeight = expectedKind === 'thumbnail' ? 600 : 1200;
  const width = Number(object.customMetadata.width);
  const height = Number(object.customMetadata.height);
  const bytes = Number(object.customMetadata.bytes);
  if (width !== expectedWidth || height !== expectedHeight || !Number.isFinite(bytes) || bytes > 200_000) {
    throw new Error(`${expectedKind} 이미지 규격이 올바르지 않습니다.`);
  }
  return {
    object_key: key,
    public_url: '',
    kind: expectedKind,
    part_index: 0,
    width,
    height,
    bytes,
    created_at: new Date().toISOString(),
  } satisfies AssetRow;
}

export async function getWorkForEdit(env: AdminEnv, slug: string) {
  const workRow = await env.ACEDENT_DB.prepare(
    'SELECT payload_json, status FROM works WHERE slug = ?',
  ).bind(slug).first<{ payload_json: string; status: string }>();
  if (!workRow) return json({ error: '수정할 사례를 찾을 수 없습니다.' }, 404);

  try {
    const work = JSON.parse(workRow.payload_json) as WorkItem;
    const assets = await env.ACEDENT_DB.prepare(
      `SELECT object_key, public_url, kind, part_index, width, height, bytes, created_at
       FROM work_assets WHERE work_slug = ? ORDER BY part_index, kind`,
    ).bind(slug).all<AssetRow>();
    return json({ work, status: workRow.status, assets: assets.results });
  } catch {
    return json({ error: '저장된 사례 데이터를 읽지 못했습니다.' }, 500);
  }
}

export async function updateWork(env: AdminEnv, slug: string, input: UpdateInput) {
  const row = await env.ACEDENT_DB.prepare(
    'SELECT payload_json, status FROM works WHERE slug = ?',
  ).bind(slug).first<{ payload_json: string; status: string }>();
  if (!row) return json({ error: '수정할 사례를 찾을 수 없습니다.' }, 404);
  if (row.status !== 'published') return json({ error: '삭제 대기 중인 사례는 수정할 수 없습니다.' }, 409);

  try {
    const previous = JSON.parse(row.payload_json) as WorkItem;
    const date = required(input.date, '작업 완료일', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('작업 완료일 형식이 올바르지 않습니다.');
    if (!isWorkCategory(String(input.category))) throw new Error('카테고리를 선택하세요.');
    const category = String(input.category) as WorkItem['category'];
    const uploadId = typeof input.uploadId === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(input.uploadId)
      ? input.uploadId
      : '';
    if (!Array.isArray(input.parts) || input.parts.length === 0 || input.parts.length > 20) {
      throw new Error('작업 부위를 1개 이상 20개 이하로 입력하세요.');
    }

    const parts = (input.parts as PartInput[]).map((part, index) => {
      const workParts = normalizePartValues(part.part, index);
      const detail = typeof part.detail === 'string' ? part.detail.trim() : '';
      return {
        part: workParts,
        label: typeof part.label === 'string' && part.label.trim()
          ? part.label.trim()
          : [workParts.join(' · '), detail].filter(Boolean).join(' '),
        note: required(part.note, `${index + 1}번 부위 설명`, 300),
        before: part.before,
        after: part.after,
        thumbnail: part.thumbnail,
      };
    });

    const currentRows = await env.ACEDENT_DB.prepare(
      `SELECT object_key, public_url, kind, part_index, width, height, bytes, created_at
       FROM work_assets WHERE work_slug = ? ORDER BY part_index, kind`,
    ).bind(slug).all<AssetRow>();
    const currentAssets = new Map(currentRows.results.map((asset) => [asset.object_key, asset]));
    const publicBase = cleanPublicBase(env.R2_PUBLIC_BASE_URL);
    const usedKeys = new Set<string>();
    const records = new Map<string, AssetRow>();
    const mediaParts = [];

    for (const [index, part] of parts.entries()) {
      const [before, after, thumbnail] = await Promise.all([
        verifyAsset(env, currentAssets, part.before, 'before', uploadId),
        verifyAsset(env, currentAssets, part.after, 'after', uploadId),
        verifyAsset(env, currentAssets, part.thumbnail, 'thumbnail', uploadId),
      ]);
      for (const asset of [before, after, thumbnail]) {
        usedKeys.add(asset.object_key);
        const recorded = records.get(asset.object_key);
        if (!recorded || recorded.kind === 'thumbnail') records.set(asset.object_key, { ...asset, part_index: index });
      }
      mediaParts.push({
        part: part.part,
        label: part.label,
        before: assetUrl(publicBase, before.object_key),
        after: assetUrl(publicBase, after.object_key),
        thumbnail: assetUrl(publicBase, thumbnail.object_key),
        note: part.note,
      });
    }

    const blogUrl = typeof input.blogUrl === 'string' ? input.blogUrl.trim() : '';
    if (blogUrl && !/^https:\/\//i.test(blogUrl)) throw new Error('블로그 링크는 https:// 주소로 입력하세요.');
    const color = typeof input.color === 'string' ? input.color.trim() : '';
    if (color.length > 40) throw new Error('색상은 40자 이하여야 합니다.');
    const work: WorkItem = {
      ...previous,
      slug,
      date,
      title: required(input.title, '제목', 80),
      category,
      part: [...new Set(parts.flatMap((part) => part.part))],
      carMaker: required(input.carMaker, '차량 제조사', 40),
      carModel: optional(input.carModel, '차종', 60),
      color: color || previous.color,
      parts: mediaParts,
      summary: required(input.summary, '요약', 300),
      body: required(input.body, '상세 설명', 5000),
      blogUrl: blogUrl || undefined,
      days: required(input.days, '작업기간', 20),
    };

    const replaced = currentRows.results.filter((asset) => !usedKeys.has(asset.object_key));
    const now = new Date().toISOString();
    const statements = [
      env.ACEDENT_DB.prepare(
        'UPDATE works SET date = ?, category = ?, payload_json = ?, updated_at = ? WHERE slug = ?',
      ).bind(date, category, JSON.stringify(work), now, slug),
      ...[...records.values()].map((asset) =>
        env.ACEDENT_DB.prepare(
          `INSERT INTO work_assets
           (object_key, work_slug, public_url, kind, part_index, width, height, bytes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(object_key) DO UPDATE SET
             public_url = excluded.public_url,
             part_index = excluded.part_index,
             width = excluded.width,
             height = excluded.height,
             bytes = excluded.bytes`,
        ).bind(
          asset.object_key,
          slug,
          assetUrl(publicBase, asset.object_key),
          asset.kind,
          asset.part_index,
          asset.width,
          asset.height,
          asset.bytes,
          asset.created_at || now,
        ),
      ),
      ...[...records.keys()].map((key) =>
        env.ACEDENT_DB.prepare(
          `DELETE FROM asset_cleanup_queue WHERE object_key = ? AND work_slug = ?`,
        ).bind(key, `upload-${uploadId}`),
      ),
      ...replaced.map((asset) =>
        env.ACEDENT_DB.prepare(
          `INSERT OR REPLACE INTO asset_cleanup_queue
           (object_key, work_slug, operation, status, attempts, max_attempts, last_error, created_at, updated_at)
           VALUES (?, ?, 'replace-asset', 'pending', 0, 3, NULL, ?, ?)`,
        ).bind(asset.object_key, slug, now, now),
      ),
    ];
    await env.ACEDENT_DB.batch(statements);

    return json({ work, metadata: getWorkSeoCopy(work), cleanupPending: replaced.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : '사례 수정에 실패했습니다.';
    if (/asset_cleanup_queue|no such table/i.test(message)) {
      return json({ error: '이미지 수정에는 삭제 대기열 마이그레이션(0003)이 필요합니다.' }, 503);
    }
    return json({ error: message }, 400);
  }
}
