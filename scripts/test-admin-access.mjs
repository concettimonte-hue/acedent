import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { accessFixture } from './access-test-fixture.mjs';
import { loadTs } from './test-support.mjs';

const { requireAccess } = loadTs('functions/_shared/admin.ts');
const makeRequest = token => new Request('https://www.acedentshop.co.kr/admin/api/session', { headers: { 'Cf-Access-Jwt-Assertion': token } });

test('valid app JWT uses signed identity, not an unverified email header; status has no private data', async t => {
  const fixture = await accessFixture(t);
  const request = await fixture.request();
  request.headers.set('Cf-Access-Authenticated-User-Email', 'spoof@example.test');
  const access = await requireAccess(request, fixture.env);
  assert.equal(access.ok, true);
  assert.equal(access.email, 'owner@example.test');
  assert(access.expiresAt > Date.now());
  const response = await loadTs('functions/admin/api/session.ts').onRequestGet({ request, env: fixture.env });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { authenticated: true, expiresAt: access.expiresAt });
  assert.equal(fixture.keyRequests(), 1);
});

test('missing/forged/expired/wrong issuer or audience/invalid times/unsupported tokens all fail closed', async t => {
  const fixture = await accessFixture(t);
  const now = Math.floor(Date.now() / 1000);
  const valid = await fixture.token();
  const [header, payload, signature] = valid.split('.');
  const forged = `${header}.${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
  const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url')}.${payload}.`;
  const cases = [
    ['malformed', 'local-fixture-only'], ['bad signature', forged], ['unsigned', unsigned],
    ...await Promise.all([
      ['expired', { exp: now - 1, iat: now - 20 }],
      ['other issuer', { iss: 'https://untrusted.example' }],
      ['other app', { aud: ['other-app'] }],
      ['missing exp', { exp: undefined }], ['missing iat', { iat: undefined }],
      ['future iat', { iat: now + 60 }], ['future nbf', { nbf: now + 60 }],
      ['missing subject', { sub: '' }], ['not app token', { type: 'org' }],
      ['string expiry', { exp: '9999999999' }],
    ].map(async ([label, claims]) => [label, await fixture.token(claims)])),
    ['unknown key', await fixture.token({}, { kid: 'not-a-known-key', jku: 'https://untrusted.example/keys' })],
  ];
  for (const [label, value] of cases) {
    const result = await requireAccess(makeRequest(value), fixture.env);
    assert.equal(result.ok, false, label);
    assert.equal(result.response.status, 403, label);
    assert(!(await result.response.text()).includes(value), 'Never echo the JWT');
  }
  assert.equal((await requireAccess(new Request('https://www.acedentshop.co.kr/admin/api/session'), fixture.env)).ok, false);
  assert.equal((await requireAccess(new Request('https://other.pages.dev/admin/api/session', { headers: { 'Cf-Access-Jwt-Assertion': valid } }), fixture.env)).ok, false);
  assert.equal(fixture.keyRequests(), 1, 'Untrusted token URLs never trigger fetch; unknown key cooldown');
});

test('missing/malformed trusted configuration fails closed without key fetch', async t => {
  const fixture = await accessFixture(t);
  const request = await fixture.request();
  for (const env of [{}, { ...fixture.env, CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://evil.example' },
    { ...fixture.env, CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com@evil.example' },
    { ...fixture.env, CLOUDFLARE_ACCESS_AUD: ' ' }]) {
    const result = await requireAccess(request, env);
    assert.equal(result.ok, false);
  }
  assert.equal(fixture.keyRequests(), 0);
});

test('unavailable/malformed JWKS rejects; there is no header-only fallback', async t => {
  for (const response of [() => { throw new Error('offline'); }, () => new Response('unavailable', { status: 503 }), () => Response.json({ keys: [] }), () => new Response('<html>login</html>')]) {
    const fixture = await accessFixture(t, { fetchKeys: response });
    assert.equal((await requireAccess(await fixture.request(), fixture.env)).ok, false);
  }
});

test('concurrent verifications share only the public-key request, not authorization results', async t => {
  let resolveKeys;
  const gate = new Promise(resolve => { resolveKeys = resolve; });
  const fixture = await accessFixture(t, { fetchKeys: async jwks => { await gate; return Response.json(jwks); } });
  const valid = await fixture.request();
  const wrongAudience = await fixture.request('/admin/api/session', { aud: ['other-app'] });
  const pending = [requireAccess(valid, fixture.env), requireAccess(wrongAudience, fixture.env)];
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.keyRequests(), 1);
  resolveKeys();
  assert.deepEqual((await Promise.all(pending)).map(r => r.ok), [true, false]);
});

test('all 14 existing admin handlers plus session await verification before data/side effects', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fixture = await accessFixture(t, { fetchKeys: async jwks => { await gate; return Response.json(jwks); } });
  const env = { ...fixture.env };
  for (const key of ['ACEDENT_DB', 'ACEDENT_IMAGES', 'DEPLOY_HOOK_URL', 'CLOUDFLARE_API_TOKEN']) {
    Object.defineProperty(env, key, { get() { throw new Error(`Data accessed before auth: ${key}`); } });
  }
  const files = { analytics: ['Post', 'Get'], cleanup: ['Post'], images: ['Post'], deploy: ['Post', 'Get'], orphans: ['Get', 'Post', 'Delete'], works: ['Get', 'Post'], 'works/[slug]': ['Get', 'Put', 'Delete'], session: ['Get'] };
  const pending = [];
  let settled = 0;
  for (const [file, methods] of Object.entries(files)) {
    const source = readFileSync(new URL(`../functions/admin/api/${file}.ts`, import.meta.url), 'utf8');
    assert.equal((source.match(/await requireAccess\(request, env\)/g) || []).length, methods.length);
    const handlerModule = loadTs(`functions/admin/api/${file}.ts`);
    for (const method of methods) {
      const request = await fixture.request(`/admin/api/${file.replace('[slug]', 'fixture')}`, { aud: ['wrong-app'] });
      pending.push(handlerModule[`onRequest${method}`]({ request, env, params: { slug: 'fixture' } }).then(response => { settled++; return response; }));
    }
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, 0);
  assert.equal(fixture.keyRequests(), 1);
  release();
  const responses = await Promise.all(pending);
  assert.equal(responses.length, 15);
  assert(responses.every(r => r.status === 403));
});
