import { type WorkInput, prepareNewWork } from '../admin/api/works';
import { nextNumericWorkSlug } from './work-slug';
import { type AdminEnv } from './admin';
import {
  DraftError,
  privateBucket,
  readDraft,
  validateDraftReferences,
  type DraftRow,
} from './work-drafts';
import { draftMissing, type DraftPayload } from '../../lib/work-drafts';

type Prepared = Awaited<ReturnType<typeof prepareNewWork>>;
const leaseMs = 10 * 60_000;
const now = () => new Date().toISOString();
const changed = (r: D1Result) => Boolean(r.meta.changes);

/** Freeze a reviewed version once; resume only that snapshot, never a fresh payload. */
export async function publishDraft(
  env: AdminEnv,
  id: string,
  version: number,
  email: string,
) {
  let row = await readDraft(env, id);
  if (row.version !== version)
    throw new DraftError(
      '검토한 버전이 변경되었습니다. 다시 미리보기를 확인하세요.',
      409,
    );
  if (row.state === 'published') return row;
  if (!['review', 'publishing'].includes(row.state))
    throw new DraftError('검토 대기로 저장한 초안만 발행할 수 있습니다.', 409);
  if (
    !env.DEPLOY_HOOK_URL ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.CLOUDFLARE_API_TOKEN
  )
    throw new DraftError('배포 후크·상태 조회 설정을 먼저 확인하세요.', 503);
  if (row.lease_until && row.lease_until > now())
    throw new DraftError(
      '발행 준비가 진행 중입니다. 중복 요청하지 않고 잠시 기다려 주세요.',
      409,
    );
  const token = crypto.randomUUID();
  const until = new Date(Date.now() + leaseMs).toISOString();
  if (
    !changed(
      await env.ACEDENT_DB.prepare(
        `UPDATE work_drafts SET lease_token=?,lease_until=? WHERE id=? AND version=? AND state IN ('review','publishing') AND (lease_until IS NULL OR lease_until<=?)`,
      )
        .bind(token, until, id, version, now())
        .run(),
    )
  )
    throw new DraftError('다른 창에서 발행 중입니다.', 409);
  try {
    let prepared: Prepared;
    if (row.publish_json) prepared = JSON.parse(row.publish_json);
    else {
      const payload = JSON.parse(row.payload_json) as DraftPayload;
      const missing = draftMissing(payload);
      if (missing.length)
        throw new DraftError(`발행 전 확인: ${missing.join(', ')}`);
      await validateDraftReferences(env, id, payload);
      prepared = await prepareNewWork(
        { ...env, ACEDENT_IMAGES: privateBucket(env) },
        { ...payload, uploadId: id } as WorkInput,
      );
      // Reserve among other draft publications as well as existing public works.
      const occupied = await env.ACEDENT_DB.prepare(
        'SELECT slug FROM works UNION SELECT published_slug AS slug FROM work_drafts WHERE published_slug IS NOT NULL AND id<>?',
      )
        .bind(id)
        .all<{ slug: string }>();
      prepared.work.slug = nextNumericWorkSlug(
        prepared.slugBase,
        occupied.results.map((r) => r.slug),
      );
      const frozen = await env.ACEDENT_DB.prepare(
        `UPDATE work_drafts SET state='publishing',publish_json=?,published_slug=?,last_error=NULL WHERE id=? AND lease_token=? AND version=? AND state='review'`,
      )
        .bind(JSON.stringify(prepared), prepared.work.slug, id, token, version)
        .run();
      if (!changed(frozen))
        throw new DraftError(
          '검토 버전이 변경되었습니다. 다시 열어 주세요.',
          409,
        );
    }
    // Claims are persisted before any public copy; public orphan deletion honours them.
    await env.ACEDENT_DB.batch(
      prepared.assets.map((a) =>
        env.ACEDENT_DB.prepare(
          'UPDATE work_draft_assets SET public_key=? WHERE draft_id=? AND object_key=?',
        ).bind(a.key, id, a.key),
      ),
    );
    for (const asset of prepared.assets) {
      if (Date.now() >= Date.parse(until))
        throw new DraftError(
          '발행 준비 시간이 초과됐습니다. 같은 초안에서 재시도하세요.',
          409,
        );
      const image = await privateBucket(env).get(asset.key);
      if (!image)
        throw new DraftError(
          '비공개 원본 사진이 없습니다. 발행을 중단했습니다.',
          409,
        );
      // Immutable draft keys, deterministic destinations; retries do not create extra objects.
      const existing = await env.ACEDENT_IMAGES.head(asset.key);
      if (
        existing &&
        (existing.size !== image.size || existing.etag !== image.etag)
      )
        throw new DraftError(
          '공개 사진 키 충돌이 감지되어 발행을 중단했습니다.',
          409,
        );
      if (!existing)
        await env.ACEDENT_IMAGES.put(asset.key, image.body, {
          httpMetadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
          },
          customMetadata: image.customMetadata,
        });
    }
    const { work, assets, publicBase } = prepared;
    const stamp = now();
    const guard = `EXISTS(SELECT 1 FROM work_drafts WHERE id=? AND lease_token=? AND version=? AND state='publishing' AND lease_until>?)`;
    // All writes are conditionally fenced in one D1 transaction, including expired-worker protection.
    const results = await env.ACEDENT_DB.batch([
      env.ACEDENT_DB.prepare(`INSERT INTO works(slug,date,category,sub_categories,sub_parts,payload_json,status,created_by_email,created_at,updated_at)
        SELECT ?,?,?,?,?,?,'published',?,?,? WHERE ${guard}`).bind(
        work.slug,
        work.date,
        work.category,
        JSON.stringify(work.subCategories),
        JSON.stringify(work.subParts),
        JSON.stringify(work),
        email,
        stamp,
        stamp,
        id,
        token,
        version,
        stamp,
      ),
      ...assets.map((a) =>
        env.ACEDENT_DB.prepare(
          `INSERT INTO work_assets(object_key,work_slug,public_url,kind,part_index,width,height,bytes,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`,
        ).bind(
          a.key,
          work.slug,
          `${publicBase}/${a.key}`,
          a.kind,
          a.partIndex,
          a.width,
          a.height,
          a.bytes,
          stamp,
          id,
          token,
          version,
          stamp,
        ),
      ),
      env.ACEDENT_DB.prepare(
        `UPDATE work_drafts SET state='published',last_error=NULL,lease_token=NULL,lease_until=NULL,updated_at=? WHERE id=? AND lease_token=? AND version=? AND state='publishing' AND lease_until>?`,
      ).bind(stamp, id, token, version, stamp),
    ]);
    if (!changed(results[0]))
      throw new DraftError(
        '발행 잠금 시간이 만료됐습니다. 같은 초안에서 재시도해 주세요.',
        409,
      );
    row = await readDraft(env, id);
    return row;
  } catch (error) {
    await env.ACEDENT_DB.prepare(
      `UPDATE work_drafts SET lease_token=NULL,lease_until=NULL,last_error=? WHERE id=? AND lease_token=?`,
    )
      .bind(
        error instanceof DraftError
          ? error.message
          : '발행 준비에 실패했습니다. 원본은 보존되며 같은 버전으로 재시도할 수 있습니다.',
        id,
        token,
      )
      .run();
    throw error;
  }
}

function apiBase(env: AdminEnv) {
  return `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${env.CLOUDFLARE_PAGES_PROJECT || 'acedent-git'}`;
}
async function cloudflare(env: AdminEnv, path: string) {
  const r = await fetch(`${apiBase(env)}${path}`, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await r.json()) as {
    success?: boolean;
    result: CloudflareResult;
  };
  if (!r.ok || !data.success)
    throw new DraftError(
      'Cloudflare 상태 조회에 실패했습니다. 잠시 뒤 다시 확인하세요.',
      502,
    );
  return data.result;
}
interface CloudflareResult {
  id?: string;
  environment?: string;
  created_on?: string;
  latest_stage?: { status?: string };
  deployment_trigger?: { metadata?: { branch?: string } };
  canonical_deployment?: CloudflareResult;
}
/** A hook is not idempotent. Claim BEFORE sending; ambiguous responses never auto-resend. */
export async function requestDraftDeployment(
  env: AdminEnv,
  id: string,
  retry = false,
) {
  const row = await readDraft(env, id);
  if (row.state !== 'published')
    throw new DraftError('발행 데이터 저장이 완료되지 않았습니다.', 409);
  if (!['idle', ...(retry ? ['failed'] : [])].includes(row.deploy_state))
    return row;
  const start = now();
  const claim = await env.ACEDENT_DB.prepare(
    `UPDATE work_drafts SET deploy_state='requesting',deploy_started_at=?,deploy_id=NULL,last_error=NULL WHERE id=? AND state='published' AND deploy_state=?`,
  )
    .bind(start, id, row.deploy_state)
    .run();
  if (!changed(claim)) return readDraft(env, id);
  try {
    if (!env.DEPLOY_HOOK_URL?.startsWith('https://'))
      throw new Error('Missing hook');
    const response = await fetch(env.DEPLOY_HOOK_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => null)) as {
      id?: string;
      result?: { id?: string };
    } | null;
    const deploymentId = result?.result?.id || result?.id;
    if (
      !response.ok ||
      !deploymentId ||
      !/^[a-f0-9-]{8,64}$/i.test(deploymentId)
    )
      throw new Error('Ambiguous hook result');
    await env.ACEDENT_DB.prepare(
      `UPDATE work_drafts SET deploy_state='pending',deploy_id=? WHERE id=? AND deploy_started_at=? AND deploy_state='requesting'`,
    )
      .bind(deploymentId, id, start)
      .run();
  } catch {
    await env.ACEDENT_DB.prepare(
      `UPDATE work_drafts SET deploy_state='unknown',last_error=? WHERE id=? AND deploy_started_at=? AND deploy_state='requesting'`,
    )
      .bind(
        '배포 요청 결과를 확정할 수 없습니다. 중복 배포를 막기 위해 재요청하지 않습니다. Cloudflare에서 배포 ID를 확인해 연결하세요.',
        id,
        start,
      )
      .run();
  }
  return readDraft(env, id);
}
export async function attachDraftDeployment(
  env: AdminEnv,
  id: string,
  deploymentId: string,
) {
  if (!/^[a-f0-9-]{8,64}$/i.test(deploymentId))
    throw new DraftError('배포 ID를 확인하세요.');
  const row = await readDraft(env, id);
  if (!['requesting', 'unknown'].includes(row.deploy_state))
    throw new DraftError('확인 대기 상태에서만 연결할 수 있습니다.', 409);
  const deployment = await cloudflare(env, `/deployments/${deploymentId}`);
  if (
    deployment.environment !== 'production' ||
    deployment.deployment_trigger?.metadata?.branch !== 'main' ||
    !row.deploy_started_at ||
    !deployment.created_on ||
    deployment.created_on < row.deploy_started_at
  )
    throw new DraftError('이번 발행 이후 main 운영 배포만 연결할 수 있습니다.');
  await env.ACEDENT_DB.prepare(
    `UPDATE work_drafts SET deploy_id=?,deploy_state='pending',last_error=NULL WHERE id=? AND deploy_state IN ('requesting','unknown')`,
  )
    .bind(deploymentId, id)
    .run();
}
export async function checkDraftDeployment(
  env: AdminEnv,
  id: string,
): Promise<DraftRow> {
  const row = await readDraft(env, id);
  if (!row.deploy_id || !['pending', 'verifying'].includes(row.deploy_state))
    return row;
  const deployment = await cloudflare(env, `/deployments/${row.deploy_id}`);
  if (
    deployment.environment !== 'production' ||
    deployment.deployment_trigger?.metadata?.branch !== 'main'
  )
    throw new DraftError('운영 main 배포가 아닙니다.', 409);
  let state = 'pending';
  let error: string | null = null;
  if (['failure', 'canceled'].includes(deployment.latest_stage?.status || '')) {
    state = 'failed';
    error =
      'Cloudflare 빌드가 실패/취소되었습니다. 배포 로그 확인 후 같은 사례로 배포를 재시도하세요.';
  } else if (deployment.latest_stage?.status === 'success') {
    state = 'verifying';
    // A successful preview build alone is NOT proof of publication on the canonical site.
    const project = await cloudflare(env, '');
    const current = project.canonical_deployment;
    const currentIncludesBuild =
      current?.id === row.deploy_id ||
      (current?.environment === 'production' &&
        current.deployment_trigger?.metadata?.branch === 'main' &&
        current.latest_stage?.status === 'success' &&
        typeof current.created_on === 'string' &&
        typeof deployment.created_on === 'string' &&
        current.created_on >= deployment.created_on);
    // A subsequent successful production build can also contain this publication.
    // In either case the live canonical HTML AND sitemap must still prove the case.
    if (currentIncludesBuild) {
      const canonical = `https://www.acedentshop.co.kr/works/detail/${row.published_slug}`;
      const responses = await Promise.all(
        [canonical, 'https://www.acedentshop.co.kr/sitemap.xml'].map((url) =>
          fetch(`${url}?draft_deploy=${row.deploy_id}`, {
            headers: { 'Cache-Control': 'no-cache' },
            signal: AbortSignal.timeout(15_000),
          }),
        ),
      );
      if (responses.every((r) => r.ok)) {
        const [html, sitemap] = await Promise.all(
          responses.map((r) => r.text()),
        );
        const prepared = JSON.parse(row.publish_json!) as Prepared;
        if (
          html.includes(canonical) &&
          html.includes(prepared.work.parts[0].after) &&
          sitemap.includes(`<loc>${canonical}</loc>`)
        )
          state = 'ready';
      }
    }
  }
  await env.ACEDENT_DB.prepare(
    'UPDATE work_drafts SET deploy_state=?,last_error=? WHERE id=? AND deploy_id=?',
  )
    .bind(state, error, id, row.deploy_id)
    .run();
  return readDraft(env, id);
}
