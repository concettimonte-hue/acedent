// Local-only signatures/keys, never production credentials or network.
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

let sequence = 0;
let keyPair;
const originalFetch = globalThis.fetch;
export async function accessFixture(t, { fetchKeys } = {}) {
  keyPair ??= generateKeyPair('RS256');
  const { privateKey, publicKey } = await keyPair;
  const issuer = `https://local-test-${++sequence}.cloudflareaccess.com`;
  const env = { CLOUDFLARE_ACCESS_TEAM_DOMAIN: issuer, CLOUDFLARE_ACCESS_AUD: 'local-admin-app' };
  const jwks = { keys: [{ ...await exportJWK(publicKey), kid: 'local-test-key', alg: 'RS256', use: 'sig' }] };
  let keyRequests = 0;
  globalThis.fetch = async (url, options) => {
    if (url !== `${issuer}/cdn-cgi/access/certs`) throw new Error('Test blocked unexpected network');
    keyRequests++;
    if (options?.headers && new Headers(options.headers).has('Authorization')) throw new Error('JWT must not be sent to JWKS');
    return fetchKeys ? fetchKeys(jwks, options) : Response.json(jwks);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const token = async (overrides = {}, header = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ iss: issuer, aud: [env.CLOUDFLARE_ACCESS_AUD], iat: now - 10, exp: now + 120, sub: 'local-owner', type: 'app', email: 'owner@example.test', ...overrides })
      .setProtectedHeader({ alg: 'RS256', kid: 'local-test-key', ...header }).sign(privateKey);
  };
  const request = async (path = '/admin/api/session', overrides = {}) => new Request(`https://www.acedentshop.co.kr${path}`, {
    headers: { 'Cf-Access-Jwt-Assertion': await token(overrides) },
  });
  return { env, token, request, jwks, keyRequests: () => keyRequests };
}
