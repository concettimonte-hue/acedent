import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AccessEnv {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
}

// Only keys are cached, never identities or authorization decisions.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function verifyAccessAssertion(assertion: string, env: AccessEnv) {
  const issuer = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/, '');
  const audience = env.CLOUDFLARE_ACCESS_AUD?.trim();
  if (!issuer || !/^https:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer) ||
    !audience || /\s|,/.test(audience)) {
    throw new Error('Access configuration unavailable');
  }
  let keys = keySets.get(issuer);
  if (!keys) {
    // No token-controlled issuer, jku, x5u or embedded JWK is trusted.
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      cacheMaxAge: 5 * 60_000,
      cooldownDuration: 30_000,
      timeoutDuration: 3_000,
    });
    if (keySets.size >= 2) keySets.delete(keySets.keys().next().value!);
    keySets.set(issuer, keys);
  }
  const { payload } = await jwtVerify(assertion, keys, {
    algorithms: ['RS256'],
    issuer,
    audience,
    requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'],
    clockTolerance: 0,
  });
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.iat) ||
    payload.iat! > now || payload.exp! <= payload.iat! || !payload.sub?.trim() || payload.type !== 'app') {
    throw new Error('Invalid Access application claims');
  }
  return {
    email: typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : payload.sub,
    expiresAt: payload.exp! * 1000,
  };
}
