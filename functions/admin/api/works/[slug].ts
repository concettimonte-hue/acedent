import { json, requireAccess, type AdminEnv } from '../../../_shared/admin';

function readSlug(value: string | string[] | undefined) {
  const slug = Array.isArray(value) ? value[0] : value;
  if (!slug || !/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  return slug;
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /asset_cleanup_queue|no such table/i.test(message);
}

export const onRequestDelete: PagesFunction<AdminEnv> = async ({ request, env, params }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) {
    return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);
  }

  const slug = readSlug(params.slug);
  if (!slug) return json({ error: '사례 주소가 올바르지 않습니다.' }, 400);

  try {
    const work = await env.ACEDENT_DB.prepare(
      'SELECT slug, status, payload_json FROM works WHERE slug = ?',
    ).bind(slug).first<{ slug: string; status: string; payload_json: string }>();
    if (!work) return json({ error: '삭제할 사례를 찾을 수 없습니다.' }, 404);

    const assetRows = await env.ACEDENT_DB.prepare(
      'SELECT object_key FROM work_assets WHERE work_slug = ? ORDER BY part_index, kind',
    ).bind(slug).all<{ object_key: string }>();
    if (assetRows.results.length === 0) {
      return json({ error: '연결된 이미지 기록이 없어 삭제를 중단했습니다.' }, 409);
    }

    const now = new Date().toISOString();
    const statements = [
      env.ACEDENT_DB.prepare(
        `UPDATE works SET status = 'draft', updated_at = ? WHERE slug = ?`,
      ).bind(now, slug),
      ...assetRows.results.map((asset) =>
        env.ACEDENT_DB.prepare(
          `INSERT OR IGNORE INTO asset_cleanup_queue
           (object_key, work_slug, operation, status, attempts, max_attempts, last_error, created_at, updated_at)
           VALUES (?, ?, 'delete-work', 'pending', 0, 3, NULL, ?, ?)`,
        ).bind(asset.object_key, slug, now, now),
      ),
    ];
    await env.ACEDENT_DB.batch(statements);

    let title = slug;
    try {
      const payload = JSON.parse(work.payload_json) as { title?: unknown };
      if (typeof payload.title === 'string' && payload.title.trim()) title = payload.title.trim();
    } catch {
      // 삭제 자체는 payload_json 표시용 필드 파싱 실패와 무관하게 진행합니다.
    }

    return json({
      status: 'pending-deploy',
      slug,
      title,
      assetCount: assetRows.results.length,
      message: '공개 사이트 반영 후 이미지와 사례 데이터가 최종 삭제됩니다.',
    });
  } catch (error) {
    if (migrationError(error)) {
      return json({ error: '삭제 대기열 마이그레이션(0003)을 먼저 적용해야 합니다.' }, 503);
    }
    return json({ error: error instanceof Error ? error.message : '삭제 준비에 실패했습니다.' }, 500);
  }
};
