import { json, requireAccess, type AdminEnv } from '../../_shared/admin';

interface CloudflareDeployment {
  id: string;
  url: string;
  created_on: string;
  latest_stage?: { name?: string; status?: string };
  deployment_trigger?: { metadata?: { branch?: string } };
}

function readDeploymentId(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const directId = typeof record.id === 'string' ? record.id : undefined;
  const result = record.result && typeof record.result === 'object'
    ? record.result as Record<string, unknown>
    : undefined;
  const resultId = typeof result?.id === 'string' ? result.id : undefined;
  const id = directId || resultId;
  return id && /^[a-f0-9-]{8,64}$/i.test(id) ? id : undefined;
}

async function verifyPublishedWork(deployment: CloudflareDeployment, slug: string) {
  try {
    const baseUrl = new URL(deployment.url);
    if (baseUrl.protocol !== 'https:' || !baseUrl.hostname.endsWith('.pages.dev')) {
      return { ready: false, detail: false, sitemap: false };
    }
    const marker = encodeURIComponent(deployment.id);
    const [detailResponse, sitemapResponse] = await Promise.all([
      fetch(`${baseUrl.origin}/works/detail/${slug}?deployment=${marker}`, {
        headers: { 'Cache-Control': 'no-cache' },
      }),
      fetch(`${baseUrl.origin}/sitemap.xml?deployment=${marker}`, {
        headers: { 'Cache-Control': 'no-cache' },
      }),
    ]);
    const [detailHtml, sitemapXml] = await Promise.all([
      detailResponse.ok ? detailResponse.text() : Promise.resolve(''),
      sitemapResponse.ok ? sitemapResponse.text() : Promise.resolve(''),
    ]);
    const canonical = `https://www.acedentshop.co.kr/works/detail/${slug}`;
    const detail = detailResponse.ok && detailHtml.includes(canonical);
    const sitemap = sitemapResponse.ok && sitemapXml.includes(`<loc>${canonical}</loc>`);
    return { ready: detail && sitemap, detail, sitemap };
  } catch {
    return { ready: false, detail: false, sitemap: false };
  }
}

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;
  if (!env.DEPLOY_HOOK_URL || !/^https:\/\//i.test(env.DEPLOY_HOOK_URL)) {
    return json({ error: 'DEPLOY_HOOK_URL 설정이 필요합니다.' }, 503);
  }

  const startedAt = new Date().toISOString();
  const response = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  if (!response.ok) return json({ error: `배포 요청 실패: HTTP ${response.status}` }, 502);

  let hookResult: unknown = null;
  try {
    hookResult = await response.json();
  } catch {
    hookResult = null;
  }
  return json({
    status: 'queued',
    startedAt,
    deploymentId: readDeploymentId(hookResult),
  }, 202);
};

export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = requireAccess(request);
  if (!access.ok) return access.response;

  const project = env.CLOUDFLARE_PAGES_PROJECT || 'acedent-git';
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    return json({ error: 'Cloudflare 배포 조회 설정이 필요합니다.' }, 503);
  }

  const requestUrl = new URL(request.url);
  const since = requestUrl.searchParams.get('since');
  const deploymentId = requestUrl.searchParams.get('deploymentId');
  const slug = requestUrl.searchParams.get('slug');
  if (deploymentId && !/^[a-f0-9-]{8,64}$/i.test(deploymentId)) {
    return json({ error: '배포 식별자가 올바르지 않습니다.' }, 400);
  }
  if (slug && !/^[a-z0-9-]{1,160}$/.test(slug)) {
    return json({ error: '사례 주소가 올바르지 않습니다.' }, 400);
  }

  const apiBase = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/deployments`;
  const response = await fetch(
    deploymentId
      ? `${apiBase}/${deploymentId}`
      : `${apiBase}?env=production&page=1&per_page=10`,
    { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } },
  );
  const payload = (await response.json()) as {
    success?: boolean;
    result?: CloudflareDeployment | CloudflareDeployment[];
  };
  if (!response.ok || !payload.success) return json({ error: '배포 상태 조회에 실패했습니다.' }, 502);

  const deployment = Array.isArray(payload.result)
    ? payload.result.find((item) => {
        if (item.deployment_trigger?.metadata?.branch !== 'main') return false;
        return !since || item.created_on >= since;
      })
    : payload.result;
  if (!deployment) return json({ status: 'waiting' });

  const deploymentStatus = deployment.latest_stage?.status || 'active';
  if (deploymentStatus === 'success' && slug) {
    const verification = await verifyPublishedWork(deployment, slug);
    if (!verification.ready) {
      return json({
        status: 'verifying',
        stage: 'content-check',
        url: deployment.url,
        createdOn: deployment.created_on,
        deploymentId: deployment.id,
        verification,
      });
    }
  }

  return json({
    status: deploymentStatus,
    stage: deployment.latest_stage?.name || 'queued',
    url: deployment.url,
    createdOn: deployment.created_on,
    deploymentId: deployment.id,
  });
};
