// Local functions + disposable SQLite only. Never creates production visits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyticsFixture } from './analytics-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import { loadTs } from './test-support.mjs';

const { visitAttribution, isVisitSource, isAiVisitSource } = loadTs('lib/visit-acquisition.ts');
const collector = loadTs('functions/api/visit.ts').onRequestPost;
const admin = loadTs('functions/admin/api/analytics.ts').onRequestGet;
const origin = 'https://www.acedentshop.co.kr';
const path = '/works/detail/sample-door';
const services = [
  { source: 'ai-chatgpt', host: 'chatgpt.com', tags: ['chatgpt', 'chatgpt.com', 'chat.openai.com'] },
  { source: 'ai-gemini', host: 'gemini.google.com', tags: ['gemini', 'gemini.google.com'] },
  { source: 'ai-claude', host: 'claude.ai', tags: ['claude', 'claude.ai'] },
  { source: 'ai-perplexity', host: 'perplexity.ai', tags: ['perplexity', 'perplexity.ai'] },
];
const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const request = (body, cookie = '', headers = {}) => new Request(`${origin}/api/visit`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(body),
});

test('each AI service has bounded web-referrer and explicit UTM classifications, including legacy ChatGPT domain', () => {
  for (const service of services) {
    assert(isVisitSource(service.source)); assert(isAiVisitSource(service.source));
    for (const referrer of [`https://${service.host}/private-conversation`, `https://www.${service.host}/`, `https://${service.host.toUpperCase()}./`]) {
      assert.deepEqual(visitAttribution(referrer, `${origin}${path}`), { source: service.source, basis: 'web-referrer' });
    }
    for (const tag of service.tags) {
      const url = `${origin}${path}?utm_source=${encodeURIComponent(` ${tag.toUpperCase()} `)}&utm_campaign=private-query`;
      for (const referrer of ['', 'https://www.google.com/', 'https://link.example/']) {
        assert.deepEqual(visitAttribution(referrer, url), { source: service.source, basis: 'link-tag' });
      }
    }
  }
  assert.deepEqual(visitAttribution('https://chat.openai.com/c/private', `${origin}${path}`), { source: 'ai-chatgpt', basis: 'web-referrer' });
  assert.equal(isAiVisitSource('google'), false); assert.equal(isAiVisitSource('__proto__'), false);
});

test('unknown origins, lookalike domains and generic AI terms are never guessed as AI referrals', () => {
  for (const service of services) {
    for (const host of [`${service.host}.example.org`, `not-${service.host}`]) {
      assert.equal(isAiVisitSource(visitAttribution(`https://${host}/`, `${origin}${path}`).source), false);
    }
    assert.deepEqual(visitAttribution(`https://${service.host}@example.org/`, `${origin}${path}`), { source: 'other', basis: 'web-referrer' });
    assert.deepEqual(visitAttribution('', `${origin}${path}?utm_source=${service.host}.example.org`), { source: 'direct', basis: 'unrecognized-tag' });
    assert.deepEqual(visitAttribution(`android-app://${service.host}/`, `${origin}${path}`), { source: 'direct', basis: 'unsupported-referrer' });
  }
  for (const tag of ['openai', 'ai', 'gpt', 'unknown', '__proto__']) {
    assert.deepEqual(visitAttribution('', `${origin}${path}?utm_source=${tag}`), { source: 'direct', basis: 'unrecognized-tag' });
  }
  assert.deepEqual(visitAttribution('', `${origin}${path}`), { source: 'direct', basis: 'no-referrer' });
  assert.deepEqual(visitAttribution('', `${origin}${path}?q=chatgpt`), { source: 'direct', basis: 'no-referrer' });
  assert.deepEqual(visitAttribution('https://example.org/chatgpt.com', `${origin}${path}`), { source: 'other', basis: 'web-referrer' });
  assert.deepEqual(visitAttribution('https://www.google.com/search?q=gemini', `${origin}${path}`), { source: 'google', basis: 'web-referrer' });
  assert.deepEqual(visitAttribution('https://openai.com/', `${origin}${path}`), { source: 'other', basis: 'web-referrer' });
});

test('existing ad, SMS, search and explicit campaign priorities are preserved', () => {
  const referrer = 'https://gemini.google.com/';
  for (const clickId of ['gclid', 'gbraid', 'wbraid']) {
    assert.deepEqual(visitAttribution(referrer, `${origin}/works?utm_source=chatgpt.com&${clickId}=private`), { source: 'google-ad', basis: 'ad-tag' });
  }
  for (const [query, source] of [
    ['utm_source=after_call&utm_medium=sms', 'after-call-sms'],
    ['utm_source=naver_blog', 'naver-blog'], ['utm_source=naver_place', 'naver-place'],
    ['utm_source=google', 'google'], ['utm_source=google&utm_medium=cpc', 'google-ad'],
    ['utm_source=naver&utm_medium=cpc', 'naver-ad'],
  ]) assert.deepEqual(visitAttribution(referrer, `${origin}/works?${query}`), { source, basis: 'link-tag' });
  assert.deepEqual(visitAttribution(referrer, `${origin}/works?utm_source=unknown`), { source: 'ai-gemini', basis: 'web-referrer' });
});

test('AI entries survive collection and date-scoped admin aggregation without overwriting historical rows or first sessions', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  const access = await accessFixture(t); Object.assign(f.env, access.env);
  const { shiftAnalyticsDate } = loadTs('lib/admin-analytics.ts');
  for (const source of ['direct', 'other', 'google']) f.entry(`old-${source}`, `old-${source}`, f.today, '/', source);
  f.visit('old-visitor', f.today, '/', 3);
  const old = JSON.stringify(f.db.prepare("SELECT * FROM site_visit_sessions WHERE session_id LIKE 'old-%' ORDER BY session_id").all());
  for (const service of services) {
    const attribution = visitAttribution('', `${origin}${path}?utm_source=${service.tags[0]}`);
    const first = await collector({ request: request({ path, ...attribution }), env: f.env });
    assert.equal(first.status, 204);
    for (const source of ['internal', 'google', 'ai-perplexity']) {
      await collector({ request: request({ path: '/works', source, basis: 'web-referrer' }, cookies(first)), env: f.env });
    }
  }
  const yesterday = shiftAnalyticsDate(f.today, -1);
  f.entry('yesterday-ai', 'yesterday-visitor', yesterday, '/works', 'ai-chatgpt', 'web-referrer');
  const adminRequest = await access.request('/admin/api/analytics?period=today');
  adminRequest.headers.set('Cookie', 'acedent_owner_excluded=1');
  const response = await admin({ request: adminRequest, env: f.env });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.excluded, true); assert.equal(data.acquisition.total, 7);
  for (const service of services) {
    const row = data.acquisition.rows.find(row => row.source === service.source);
    assert.equal(row.path, path); assert.equal(row.entries, 1); assert.match(row.label, /쏘나타/);
    assert.equal(data.acquisition.evidence.rows.find(row => row.source === service.source).basis, 'link-tag');
    assert.equal(data.acquisition.hours.filter(row => row.source === service.source).reduce((sum, row) => sum + row.entries, 0), 1);
  }
  for (const query of ['period=yesterday', `date=${yesterday}`]) {
    const previous = await (await admin({ request: await access.request(`/admin/api/analytics?${query}`), env: f.env })).json();
    assert.equal(previous.acquisition.total, 1); assert.equal(previous.acquisition.rows[0].source, 'ai-chatgpt');
    assert.equal(previous.acquisition.evidence.rows[0].basis, 'web-referrer');
  }
  assert.equal(JSON.stringify(f.db.prepare("SELECT * FROM site_visit_sessions WHERE session_id LIKE 'old-%' ORDER BY session_id").all()), old);
  assert.equal(f.db.prepare("SELECT page_views FROM site_visit_daily WHERE visitor_hash='old-visitor'").get().page_views, 3);
  assert(!/utm_|private-conversation|visitor_hash|session_id/.test(JSON.stringify(data.acquisition)));
  assert.equal((await admin({ request: new Request(`${origin}/admin/api/analytics`), env: f.env })).status, 403);
});

test('AI codes cannot bypass owner, DNT, bot or admin-path exclusion', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  for (const service of services) {
    for (const [cookie, headers] of [['acedent_owner_excluded=1', {}], ['', { DNT: '1' }], ['', { 'User-Agent': 'GPTBot' }]]) {
      const response = await collector({ request: request({ path, source: service.source, basis: 'link-tag' }, cookie, headers), env: f.env });
      assert.equal(response.status, 204); assert.equal(response.headers.get('Set-Cookie'), null);
    }
    assert.equal((await collector({ request: request({ path: '/admin', source: service.source }), env: f.env })).status, 400);
  }
  assert.equal(f.queries.length, 0);
  for (const table of ['site_visit_daily', 'site_visit_sessions']) assert.equal(f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
});

test('real SPA entry sends only AI code and sanitized path once; owner and admin browsers send nothing', async (t) => {
  const previous = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document };
  t.after(() => Object.assign(globalThis, previous));
  for (const service of services) for (const mode of ['visitor', 'owner', 'admin']) {
    const sent = [], timers = [], events = [];
    globalThis.fetch = async (_, options) => {
      assert.equal(options.credentials, 'same-origin'); assert.equal(options.referrerPolicy, 'no-referrer');
      sent.push(JSON.parse(options.body)); return new Response(null, { status: 204 });
    };
    const url = new URL(`${origin}${mode === 'admin' ? '/admin' : path}?utm_source=${service.tags[0]}&utm_campaign=private-campaign`);
    globalThis.document = { cookie: mode === 'owner' ? 'acedent_owner_excluded=1' : '', title: '로컬 예시', referrer: '' };
    globalThis.window = { location: { pathname: url.pathname, search: url.search, href: url.href },
      gtag: (...args) => events.push(args), history: { pushState() {}, replaceState() {} }, addEventListener() {},
      setTimeout(callback) { timers.push(callback); } };
    const client = loadTs('lib/analytics.ts', { fresh: true });
    client.initializeSpaPageViews(); client.initializeSpaPageViews();
    while (timers.length) timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(sent, mode === 'visitor' ? [{ path, source: service.source, basis: 'link-tag' }] : []);
    assert.equal(events.filter(e => e[1] === 'page_view').length, mode === 'visitor' ? 1 : 0);
  }
});
