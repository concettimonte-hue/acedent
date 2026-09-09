import { json, requireAccess, type AdminEnv } from '../../_shared/admin';

interface QueueRow {
  object_key: string;
  work_slug: string;
  operation: 'delete-work' | 'replace-asset';
  status: 'pending' | 'failed';
  attempts: number;
  last_error: string | null;
}

interface OrphanInput {
  keys?: unknown;
  releaseWorkSlug?: unknown;
}

function validKey(value: unknown): value is string {
  return typeof value === 'string' && /^works\/[a-zA-Z0-9/_-]+\.jpg$/.test(value);
}

function validSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,160}$/.test(value);
}

async function listAllObjects(bucket: R2Bucket) {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: 'works/', cursor, limit: 1000 });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) {
    return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);
  }

  try {
    const [objects, assetRows, queueRows] = await Promise.all([
      listAllObjects(env.ACEDENT_IMAGES),
      env.ACEDENT_DB.prepare('SELECT object_key FROM work_assets').all<{ object_key: string }>(),
      env.ACEDENT_DB.prepare(
        `SELECT object_key, work_slug, operation, status, attempts, last_error
         FROM asset_cleanup_queue ORDER BY updated_at DESC`,
      ).all<QueueRow>(),
    ]);
    const referenced = new Set(assetRows.results.map((row) => row.object_key));
    const queued = new Map(queueRows.results.map((row) => [row.object_key, row]));
    const orphans = objects
      .filter((object) => !referenced.has(object.key))
      .map((object) => ({
        key: object.key,
        size: object.size,
        uploaded: object.uploaded.toISOString(),
        queue: queued.get(object.key) || null,
      }))
      .sort((left, right) => right.uploaded.localeCompare(left.uploaded));
    const heldReplacements = queueRows.results.filter(
      (row) => row.operation === 'replace-asset' && referenced.has(row.object_key),
    ).length;

    return json({
      orphans,
      orphanCount: orphans.length,
      r2ObjectCount: objects.length,
      referencedCount: referenced.size,
      heldReplacements,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '고아 파일 점검에 실패했습니다.' }, 500);
  }
};

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB) return json({ error: 'D1 바인딩이 설정되지 않았습니다.' }, 503);

  try {
    const input = (await request.json()) as OrphanInput;
    if (!validSlug(input.releaseWorkSlug)) return json({ error: '사례 주소가 올바르지 않습니다.' }, 400);
    const rows = await env.ACEDENT_DB.prepare(
      `SELECT object_key FROM asset_cleanup_queue
       WHERE work_slug = ? AND operation = 'replace-asset'`,
    ).bind(input.releaseWorkSlug).all<{ object_key: string }>();
    if (rows.results.length === 0) return json({ released: 0 });

    await env.ACEDENT_DB.batch(rows.results.map((row) =>
      env.ACEDENT_DB.prepare('DELETE FROM work_assets WHERE object_key = ? AND work_slug = ?')
        .bind(row.object_key, input.releaseWorkSlug),
    ));
    return json({ released: rows.results.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '교체 이미지 정리 준비에 실패했습니다.' }, 500);
  }
};

export const onRequestDelete: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) {
    return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);
  }

  try {
    const input = (await request.json()) as OrphanInput;
    if (!Array.isArray(input.keys) || input.keys.length === 0 || input.keys.length > 100) {
      return json({ error: '삭제할 고아 파일을 1개 이상 100개 이하로 선택하세요.' }, 400);
    }
    const uniqueKeys = [...new Set(input.keys)];
    if (!uniqueKeys.every(validKey)) return json({ error: '삭제 대상 키가 올바르지 않습니다.' }, 400);
    const keys = uniqueKeys as string[];

    const placeholders = keys.map(() => '?').join(', ');
    const referenced = await env.ACEDENT_DB.prepare(
      `SELECT object_key FROM work_assets WHERE object_key IN (${placeholders})`,
    ).bind(...keys).all<{ object_key: string }>();
    if (referenced.results.length > 0) {
      return json({
        error: '선택한 파일 중 현재 사례가 사용하는 이미지가 있어 삭제를 중단했습니다.',
        referencedKeys: referenced.results.map((row) => row.object_key),
      }, 409);
    }

    await env.ACEDENT_IMAGES.delete(keys);
    await env.ACEDENT_DB.batch(keys.map((key) =>
      env.ACEDENT_DB.prepare('DELETE FROM asset_cleanup_queue WHERE object_key = ?').bind(key),
    ));
    return json({ deleted: keys.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '고아 파일 삭제에 실패했습니다.' }, 500);
  }
};
