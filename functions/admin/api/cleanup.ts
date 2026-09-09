import { json, requireAccess, type AdminEnv } from '../../_shared/admin';

interface CleanupInput {
  workSlug?: unknown;
  manualRetry?: unknown;
}

interface CleanupRow {
  object_key: string;
  status: 'pending' | 'failed';
  attempts: number;
  max_attempts: number;
}

function validSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9-]{1,160}$/.test(value);
}

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.ACEDENT_DB || !env.ACEDENT_IMAGES) {
    return json({ error: 'D1/R2 바인딩이 설정되지 않았습니다.' }, 503);
  }

  try {
    const input = (await request.json()) as CleanupInput;
    if (!validSlug(input.workSlug)) return json({ error: '정리할 사례 주소가 올바르지 않습니다.' }, 400);
    const slug = input.workSlug;
    const manualRetry = input.manualRetry === true;
    const now = new Date().toISOString();

    if (manualRetry) {
      await env.ACEDENT_DB.prepare(
        `UPDATE asset_cleanup_queue
         SET status = 'pending', attempts = 0, last_error = NULL, updated_at = ?
         WHERE work_slug = ? AND status = 'failed'`,
      ).bind(now, slug).run();
    }

    const result = await env.ACEDENT_DB.prepare(
      `SELECT object_key, status, attempts, max_attempts
       FROM asset_cleanup_queue
       WHERE work_slug = ?
       ORDER BY object_key`,
    ).bind(slug).all<CleanupRow>();
    const tasks = result.results;

    if (tasks.length === 0) {
      const work = await env.ACEDENT_DB.prepare('SELECT slug FROM works WHERE slug = ?').bind(slug).first();
      return work
        ? json({ error: '삭제 대기 이미지가 없어 정리를 중단했습니다.' }, 409)
        : json({ status: 'complete', slug, deletedAssets: 0 });
    }

    const attempts = Math.max(...tasks.map((task) => Number(task.attempts) || 0));
    const maxAttempts = Math.max(...tasks.map((task) => Number(task.max_attempts) || 3));
    if (!manualRetry && tasks.every((task) => task.status === 'failed' || task.attempts >= task.max_attempts)) {
      return json({
        status: 'failed',
        attempts,
        maxAttempts,
        error: '자동 이미지 정리가 최대 재시도 횟수에 도달했습니다. 관리 화면에서 수동 재시도하세요.',
      }, 409);
    }

    const keys = tasks.map((task) => task.object_key);
    try {
      await env.ACEDENT_IMAGES.delete(keys);
      await env.ACEDENT_DB.batch([
        env.ACEDENT_DB.prepare('DELETE FROM work_assets WHERE work_slug = ?').bind(slug),
        env.ACEDENT_DB.prepare('DELETE FROM asset_cleanup_queue WHERE work_slug = ?').bind(slug),
        env.ACEDENT_DB.prepare("DELETE FROM works WHERE slug = ? AND status = 'draft'").bind(slug),
      ]);
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : 'R2/D1 정리 중 알 수 없는 오류가 발생했습니다.';
      await env.ACEDENT_DB.prepare(
        `UPDATE asset_cleanup_queue
         SET attempts = attempts + 1,
             status = CASE WHEN attempts + 1 >= max_attempts THEN 'failed' ELSE 'pending' END,
             last_error = ?,
             updated_at = ?
         WHERE work_slug = ?`,
      ).bind(message.slice(0, 500), new Date().toISOString(), slug).run();

      const nextAttempts = attempts + 1;
      return json({
        status: nextAttempts >= maxAttempts ? 'failed' : 'pending',
        attempts: nextAttempts,
        maxAttempts,
        error: message,
      }, 502);
    }

    return json({ status: 'complete', slug, deletedAssets: keys.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : '이미지 정리에 실패했습니다.';
    if (/asset_cleanup_queue|no such table/i.test(message)) {
      return json({ error: '삭제 대기열 마이그레이션(0003)을 먼저 적용해야 합니다.' }, 503);
    }
    return json({ error: message }, 500);
  }
};
