export interface AdminEnv {
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
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

type AccessResult =
  | { ok: true; email: string }
  | { ok: false; response: Response };

interface AccessJwtPayload {
  email?: unknown;
  sub?: unknown;
}

function readAccessJwtPayload(assertion: string): AccessJwtPayload | null {
  try {
    const encodedPayload = assertion.split('.')[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as AccessJwtPayload;
  } catch {
    return null;
  }
}

export function requireAccess(request: Request): AccessResult {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  const headerEmail = request.headers.get('Cf-Access-Authenticated-User-Email')?.trim();
  if (!assertion) {
    const missingHeaders = ['Cf-Access-Jwt-Assertion'];
    if (!headerEmail) missingHeaders.push('Cf-Access-Authenticated-User-Email');
    return {
      ok: false,
      response: json({
        error: `Cloudflare Access 인증이 필요합니다: ${missingHeaders.join(', ')} 헤더가 없습니다.`,
      }, 403),
    };
  }

  const payload = readAccessJwtPayload(assertion);
  const jwtEmail = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const jwtSubject = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
  const email = headerEmail || jwtEmail || jwtSubject || 'cloudflare-access-user';
  return { ok: true, email };
}

export function cleanPublicBase(value: string | undefined) {
  if (!value || !/^https:\/\//i.test(value)) {
    throw new Error('R2_PUBLIC_BASE_URL 설정이 필요합니다.');
  }
  return value.replace(/\/$/, '');
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
