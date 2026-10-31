import { activeVisitSession, isVisitSource, isVisitBasis, VISIT_SESSION_SECONDS } from '../../lib/visit-acquisition';

interface VisitEnv {
  ACEDENT_DB: D1Database;
}

const VISITOR_COOKIE = 'acedent_visitor_id';
const OWNER_COOKIE = 'acedent_owner_excluded';
const SESSION_COOKIE = 'acedent_visit_session';
const BOT_PATTERN = /bot|crawler|spider|slurp|lighthouse|pagespeed|google-inspectiontool|facebookexternalhit|yeti|daum/i;

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('Cookie') || '';
  for (const item of cookie.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(value.join('=')); } catch { return ''; }
    }
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
  if (!path.startsWith('/') || path.startsWith('//') || path.length > 240 || /[\s?#\\]/.test(path)) return '';
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { return ''; }
  if (new URL(path, 'https://www.acedentshop.co.kr').pathname !== path) return '';
  if (/^(\/admin|\/api)(\/|$)/i.test(decoded) || /[\s?#\\]/.test(decoded) || decoded.startsWith('//')) return '';
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

  let body: { path?: unknown; source?: unknown; basis?: unknown };
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 2048) return new Response(null, { status: 413, headers });
    body = JSON.parse(text);
    if (!body || typeof body !== 'object') return new Response(null, { status: 400, headers });
  } catch {
    return new Response(null, { status: 400, headers });
  }

  const path = normalizePath(body.path);
  if (!path) return new Response(null, { status: 400, headers });

  const savedVisitorId = readCookie(request, VISITOR_COOKIE);
  const validVisitor = /^[a-z0-9-]{16,80}$/i.test(savedVisitorId);
  const visitorId = validVisitor
    ? savedVisitorId
    : crypto.randomUUID();
  const visitorHash = await hashVisitor(visitorId);
  const timestamp = new Date();
  const now = timestamp.toISOString();

  await env.ACEDENT_DB.prepare(`
    INSERT INTO site_visit_daily (
      visitor_hash, visit_date, path, page_views, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(visitor_hash, visit_date, path) DO UPDATE SET
      page_views = page_views + 1,
      last_seen_at = excluded.last_seen_at
  `).bind(visitorHash, koreanDate(timestamp), path, now, now).run();

  const responseHeaders = new Headers(headers);
  if (!validVisitor) {
    responseHeaders.append(
      'Set-Cookie',
      `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`,
    );
  }
  // Older cached clients do not send source: preserve their page counts without
  // pretending that their entry origin is known. Failure here never loses a view.
  if (isVisitSource(body.source)) {
    const sessionId = (validVisitor && activeVisitSession(readCookie(request, SESSION_COOKIE), timestamp.getTime())) || crypto.randomUUID();
    try {
      const values = [sessionId, visitorHash, now, koreanDate(timestamp), path, body.source];
      try {
        await env.ACEDENT_DB.prepare(`
          INSERT INTO site_visit_sessions (session_id, visitor_hash, started_at, visit_date, landing_path, source, source_basis)
          VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING
        `).bind(...values, isVisitBasis(body.basis) ? body.basis : 'legacy').run();
      } catch (error) {
        // Rolling deploys without 0010 still preserve the original entry. Other
        // failures are not retried, and existing sessions are never rewritten.
        if (!(error instanceof Error) || !/(?:no column named|no such column:)\s*source_basis/i.test(error.message)) throw error;
        await env.ACEDENT_DB.prepare(`
          INSERT INTO site_visit_sessions (session_id, visitor_hash, started_at, visit_date, landing_path, source)
          VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING
        `).bind(...values).run();
      }
      responseHeaders.append('Set-Cookie', `${SESSION_COOKIE}=${sessionId}.${timestamp.getTime()}; Path=/; Max-Age=${VISIT_SESSION_SECONDS}; SameSite=Lax; Secure; HttpOnly`);
    } catch {
      // Migration/temporary failure must not break the existing counter or site.
      console.warn('Visit acquisition unavailable; page view preserved.');
    }
  }
  return new Response(null, { status: 204, headers: responseHeaders });
};
