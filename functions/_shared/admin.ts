import { verifyAccessAssertion, type AccessEnv } from './access';

export interface AdminEnv extends AccessEnv {
  ACEDENT_DB: D1Database;
  ACEDENT_IMAGES: R2Bucket;
  R2_PUBLIC_BASE_URL: string;
  DEPLOY_HOOK_URL: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_PAGES_PROJECT?: string;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

type AccessResult =
  | { ok: true; email: string; expiresAt: number }
  | { ok: false; response: Response };

export async function requireAccess(request: Request, env: AccessEnv): Promise<AccessResult> {
  const hostname = new URL(request.url).hostname.toLowerCase();
  const allowedHost = hostname === 'www.acedentshop.co.kr' ||
    hostname === 'acedentshop.co.kr' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';
  if (!allowedHost) {
    return {
      ok: false,
      response: json({
        error: '관리자 API는 Cloudflare Access가 적용된 공식 도메인에서만 사용할 수 있습니다.',
      }, 403),
    };
  }

  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) {
    return {
      ok: false,
      response: json({
        error: 'Cloudflare Access 인증이 필요합니다: Cf-Access-Jwt-Assertion 헤더가 없습니다.',
      }, 403),
    };
  }

  if (!env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || !env.CLOUDFLARE_ACCESS_AUD) {
    return { ok: false, response: json({ error: 'Cloudflare Access 검증 설정이 필요합니다: CLOUDFLARE_ACCESS_TEAM_DOMAIN / CLOUDFLARE_ACCESS_AUD.' }, 503) };
  }
  try {
    return { ok: true, ...await verifyAccessAssertion(assertion, env) };
  } catch {
    // Do not log tokens, claims, cookies or upstream error bodies. Fail closed.
    return { ok: false, response: json({ error: 'Cloudflare Access 인증을 확인할 수 없습니다. 인증 만료 또는 검증 설정을 확인해 주세요.' }, 403) };
  }
}

export function cleanPublicBase(value: string | undefined) {
  if (!value || !/^https:\/\//i.test(value)) {
    throw new Error('R2_PUBLIC_BASE_URL 설정이 필요합니다.');
  }
  return value.replace(/\/+$/, '');
}

export function safeSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function jpegDimensions(bytes: Uint8Array) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}
