import { json, requireAccess, type AdminEnv } from '../../_shared/admin';

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
  return json({ status: 'queued', startedAt, hookResult }, 202);
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
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${project}/deployments?env=production&page=1&per_page=10`,
    { headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } },
  );
  const payload = (await response.json()) as {
    success?: boolean;
    result?: Array<{
      id: string;
      url: string;
      created_on: string;
      latest_stage?: { name?: string; status?: string };
      deployment_trigger?: { metadata?: { branch?: string } };
    }>;
  };
  if (!response.ok || !payload.success) return json({ error: '배포 상태 조회에 실패했습니다.' }, 502);

  const deployment = payload.result?.find((item) => {
    if (item.deployment_trigger?.metadata?.branch !== 'main') return false;
    return !since || item.created_on >= since;
  });
  if (!deployment) return json({ status: 'waiting' });

  return json({
    status: deployment.latest_stage?.status || 'active',
    stage: deployment.latest_stage?.name || 'queued',
    url: deployment.url,
    createdOn: deployment.created_on,
  });
};
