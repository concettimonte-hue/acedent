interface VisitEnv {
  ACEDENT_DB: D1Database;
}

const VISITOR_COOKIE = 'acedent_visitor_id';
const OWNER_COOKIE = 'acedent_owner_excluded';
const BOT_PATTERN = /bot|crawler|spider|slurp|lighthouse|pagespeed|google-inspectiontool|facebookexternalhit|yeti|daum/i;

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('Cookie') || '';
  for (const item of cookie.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function koreanDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizePath(value: unknown) {
  if (typeof value !== 'string') return '';
  const path = value.trim();
  if (!path.startsWith('/') || path.length > 240 || /[\s?#]/.test(path)) return '';
  if (path === '/admin' || path.startsWith('/admin/')) return '';
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

async function hashVisitor(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost: PagesFunction<VisitEnv> = async ({ request, env }) => {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');

  if (
    (origin && origin !== new URL(request.url).origin) ||
    fetchSite === 'cross-site'
  ) {
    return new Response(null, { status: 403, headers });
  }

  if (
    readCookie(request, OWNER_COOKIE) === '1' ||
    request.headers.get('DNT') === '1' ||
    BOT_PATTERN.test(request.headers.get('User-Agent') || '')
  ) {
    return new Response(null, { status: 204, headers });
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 2048) return new Response(null, { status: 413, headers });

  let body: { path?: unknown };
  try {
    body = await request.json() as { path?: unknown };
  } catch {
    return new Response(null, { status: 400, headers });
  }

  const path = normalizePath(body.path);
  if (!path) return new Response(null, { status: 400, headers });

  const savedVisitorId = readCookie(request, VISITOR_COOKIE);
  const visitorId = /^[a-z0-9-]{16,80}$/i.test(savedVisitorId)
    ? savedVisitorId
    : crypto.randomUUID();
  const visitorHash = await hashVisitor(visitorId);
  const now = new Date().toISOString();

  await env.ACEDENT_DB.prepare(`
    INSERT INTO site_visit_daily (
      visitor_hash, visit_date, path, page_views, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(visitor_hash, visit_date, path) DO UPDATE SET
      page_views = page_views + 1,
      last_seen_at = excluded.last_seen_at
  `).bind(visitorHash, koreanDate(), path, now, now).run();

  const responseHeaders = new Headers(headers);
  if (!savedVisitorId) {
    responseHeaders.append(
      'Set-Cookie',
      `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
    );
  }
  return new Response(null, { status: 204, headers: responseHeaders });
};
