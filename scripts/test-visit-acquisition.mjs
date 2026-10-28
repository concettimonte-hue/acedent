import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { analyticsFixture } from './analytics-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import { loadTs } from './test-support.mjs';

const { visitSource, activeVisitSession, isVisitSource } = loadTs('lib/visit-acquisition.ts');
const collector = loadTs('functions/api/visit.ts').onRequestPost;
const admin = loadTs('functions/admin/api/analytics.ts').onRequestGet;
const origin = 'https://www.acedentshop.co.kr';
const cookiesFrom = (response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
function request(body, cookie = '', headers = {}) {
  return new Request(`${origin}/api/visit`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(body) });
}

test('only bounded source codes are emitted; search terms, ad IDs and misleading hostnames never leak', () => {
  for (const [referrer, expected] of [
    ['https://m.search.naver.com/search.naver?query=private-query', 'naver-search'],
    ['https://blog.naver.com/private-author/123', 'naver-blog'],
    ['https://m.place.naver.com/place/123', 'naver-place'],
    ['https://map.naver.com/p/entry/123', 'naver-place'],
    ['https://naver.me/secret', 'naver-other'],
    ['https://www.google.co.kr/search?q=private-query', 'google'],
    ['https://www.google.com/search?q=private-query', 'google'],
    ['android-app://com.google.android.googlequicksearchbox/', 'google'],
    ['https://search.daum.net/search?q=private', 'daum'],
    ['https://bing.com/search?q=private', 'bing'],
    ['https://l.instagram.com/private', 'social'],
    [`${origin}/works?private=1`, 'internal'],
    ['https://acedentshop.co.kr/works', 'internal'],
    ['https://search.naver.com.evil.example/secret', 'other'],
    ['', 'direct'], ['not-a-url', 'direct'], ['javascript:alert(1)', 'direct'],
  ]) assert.equal(visitSource(referrer, `${origin}/works`), expected, referrer);
  assert.equal(visitSource('', `${origin}/works?gclid=private-click`), 'google-ad');
  assert.equal(visitSource('', `${origin}/works?utm_source=naver&utm_medium=cpc&utm_campaign=private`), 'naver-ad');
  assert.equal(visitSource('', `${origin}/works?utm_source=naver_blog`), 'naver-blog');
  assert.equal(visitSource('', `${origin}/works?utm_source=person@example.com`), 'direct');
  assert.equal(isVisitSource('__proto__'), false);
  assert.equal(isVisitSource('https://google.com'), false);
});

test('session expires after 30 minutes, rejects future/malformed timestamps, and does not reset at KST midnight', () => {
  const id = crypto.randomUUID();
  const beforeMidnight = Date.parse('2026-10-27T14:59:00Z');
  const cookie = `${id}.${beforeMidnight}`;
  assert.equal(activeVisitSession(cookie, beforeMidnight + 29 * 60000), id);
  assert.equal(activeVisitSession(cookie, beforeMidnight + 30 * 60000), null);
  assert.equal(activeVisitSession(cookie, beforeMidnight - 1), null);
  assert.equal(activeVisitSession('bad.cookie', beforeMidnight), null);
});

test('one entry survives internal navigation and reload; timeout opens a second entry without changing legacy view counts', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  const first = await collector({ request: request({ path: '/works/detail/sample-door', source: 'naver-search' }), env: f.env });
  assert.equal(first.status, 204);
  let cookie = cookiesFrom(first);
  assert.match(cookie, /acedent_visitor_id=/); assert.match(cookie, /acedent_visit_session=/);
  for (const path of ['/works', '/works/detail/sample-door']) {
    const response = await collector({ request: request({ path, source: 'internal' }, cookie), env: f.env });
    assert.equal(response.status, 204);
    cookie = cookie.replace(/acedent_visit_session=[^;]+/, cookiesFrom(response));
  }
  const rows = f.db.prepare('SELECT * FROM site_visit_sessions').all();
  assert.equal(rows.length, 1); assert.equal(rows[0].landing_path, '/works/detail/sample-door'); assert.equal(rows[0].source, 'naver-search');
  assert.equal(f.db.prepare('SELECT SUM(page_views) AS views FROM site_visit_daily').get().views, 3);
  const expired = cookie.replace(/(acedent_visit_session=[a-f0-9-]+)\.\d+/, `$1.${Date.now() - 31 * 60000}`);
  await collector({ request: request({ path: '/', source: 'direct' }, expired), env: f.env });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM site_visit_sessions').get().n, 2);
  assert.equal(f.db.prepare('SELECT COUNT(DISTINCT visitor_hash) AS n FROM site_visit_daily').get().n, 1);
  assert.equal(f.db.prepare('SELECT SUM(page_views) AS views FROM site_visit_daily').get().views, 4);
  assert(!JSON.stringify(rows).includes('private-query'));
});

test('owner/DNT/bots/auth-path/cross-site checks stop both tables before a write', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  for (const [path, cookie, headers, status] of [
    ['/works', 'acedent_owner_excluded=1', {}, 204],
    ['/works', '', { DNT: '1' }, 204],
    ['/works', '', { 'User-Agent': 'Googlebot' }, 204],
    ['/works', '', { Origin: 'https://evil.example' }, 403],
    ['/admin', '', {}, 400], ['/admin/api/works', '', {}, 400], ['/api/visit', '', {}, 400],
    ['/%61dmin', '', {}, 400], ['/works/../admin', '', {}, 400], ['/works/%2e%2e/admin', '', {}, 400], ['//evil.example', '', {}, 400], ['/works?email=private', '', {}, 400],
  ]) assert.equal((await collector({ request: request({ path, source: 'google' }, cookie, headers), env: f.env })).status, status);
  assert.equal(f.queries.length, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM site_visit_sessions').get().n, 0);
});

test('additive migration preserves existing rows; old clients and absent new table keep recording views', async (t) => {
  const f = analyticsFixture({ seed: false, acquisition: false }); t.after(() => f.db.close());
  const old = await collector({ request: request({ path: '/works' }), env: f.env });
  const cookie = cookiesFrom(old);
  const before = JSON.stringify(f.db.prepare('SELECT * FROM site_visit_daily').all());
  assert.equal(old.status, 204);
  const partial = await collector({ request: request({ path: '/', source: 'google' }, cookie), env: f.env });
  assert.equal(partial.status, 204);
  assert.equal(f.db.prepare('SELECT SUM(page_views) AS views FROM site_visit_daily').get().views, 2);
  assert(!cookiesFrom(partial).includes('acedent_visit_session'));
  const migration = readFileSync(new URL('../migrations/0009_visit_acquisition.sql', import.meta.url), 'utf8');
  f.db.exec(migration); f.db.exec(migration);
  assert.equal(JSON.stringify(f.db.prepare("SELECT * FROM site_visit_daily WHERE path='/works'").all()), before);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM site_visit_sessions').get().n, 0);
  await collector({ request: request({ path: '/', source: 'google' }, cookie), env: f.env });
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM site_visit_sessions').get().n, 1);
});

test('read API scopes source/landing pairs to the same date, protects access, and distinguishes unavailable/old data', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  const access = await accessFixture(t); Object.assign(f.env, access.env);
  const { shiftAnalyticsDate: shift } = loadTs('lib/admin-analytics.ts');
  f.entry('a', 'v1', f.today, '/works/detail/sample-door', 'naver-search');
  f.entry('b', 'v1', f.today, '/', 'google');
  f.entry('c', 'v2', f.today, '/', 'naver-search');
  f.entry('d', 'v3', shift(f.today, -1), '/works/detail/sample-bumper', 'google');
  f.visit('v1', shift(f.today, -10), '/', 2);
  async function get(query) {
    const response = await admin({ request: await access.request(`/admin/api/analytics?${query}`), env: f.env });
    assert.equal(response.status, 200); return response.json();
  }
  const snapshot = JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all());
  const today = (await get('period=today')).acquisition;
  assert.equal(today.available, true); assert.equal(today.total, 3); assert.equal(today.rows.length, 3);
  assert.match(today.rows.find(r => r.path.endsWith('sample-door')).label, /쏘나타/);
  assert(today.rows.every(r => !('visitor_hash' in r) && !('session_id' in r)));
  assert.equal((await get('period=yesterday')).acquisition.total, 1);
  const old = await get(`date=${shift(f.today, -10)}`);
  assert.equal(old.period.views, 2); assert.equal(old.acquisition.total, 0); assert(old.acquisition.trackingSince);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all()), snapshot);
  assert.equal((await admin({ request: new Request(`${origin}/admin/api/analytics`), env: f.env })).status, 403);
  f.db.exec('DROP TABLE site_visit_sessions'); // Disposable in-memory test database only.
  const missing = await get('period=today');
  assert.equal(missing.acquisition.error, 'migration-required'); assert.equal(missing.acquisition.available, false);
  assert(missing.topPages.length > 0);
});

test('client sends sanitized first-entry data once; SPA navigation is internal and query-only changes never inflate counts', async (t) => {
  const originalFetch = globalThis.fetch; const originalWindow = globalThis.window; const originalDocument = globalThis.document;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.window = originalWindow; globalThis.document = originalDocument; });
  let sent = []; const timers = []; const events = [];
  globalThis.fetch = async (_, options) => { assert.equal(options.referrerPolicy, 'no-referrer'); sent.push(JSON.parse(options.body)); return new Response(null, { status: 204 }); };
  function install(path, cookie = '') {
    globalThis.document = { cookie, title: 'sample', referrer: 'https://m.search.naver.com/?query=private-secret' };
    globalThis.window = { location: { pathname: path, search: '', href: `${origin}${path}` }, gtag: (...args) => events.push(args),
      history: { pushState() {}, replaceState() {} }, addEventListener() {}, setTimeout(callback) { timers.push(callback); } };
  }
  const flush = async () => { while (timers.length) timers.shift()(); await new Promise(resolve => setImmediate(resolve)); };
  const client = loadTs('lib/analytics.ts', { fresh: true });
  install('/works/detail/sample-door'); client.initializeSpaPageViews(); client.initializeSpaPageViews(); await flush();
  window.location = { pathname: '/works', search: '', href: `${origin}/works` }; window.history.pushState(); await flush();
  window.location.search = '?part=범퍼'; window.history.pushState(); await flush();
  assert.deepEqual(sent, [{ path: '/works/detail/sample-door', source: 'naver-search' }, { path: '/works', source: 'internal' }]);
  assert(!JSON.stringify(sent).includes('private-secret')); assert.equal(events.filter(e => e[1] === 'page_view').length, 3);
  for (const [path, cookie] of [['/admin', ''], ['/works', 'acedent_owner_excluded=1']]) {
    sent = []; install(path, cookie); client.initializeSpaPageViews(); await flush(); assert.equal(sent.length, 0);
  }
});
