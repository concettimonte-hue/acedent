import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { loadTs } from './test-support.mjs';
import { analyticsFixture } from './analytics-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const { visitAttribution, isVisitBasis } = loadTs('lib/visit-acquisition.ts');
const collector = loadTs('functions/api/visit.ts').onRequestPost;
const admin = loadTs('functions/admin/api/analytics.ts').onRequestGet;
const origin = 'https://www.acedentshop.co.kr';
const request = (body, cookie = '', headers = {}) => new Request(`${origin}/api/visit`, {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: JSON.stringify(body),
});
const cookies = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');

test('app identity is exact, Naver app is not called search, and only bounded evidence leaves the classifier', () => {
  for (const [referrer, source, basis] of [
    ['android-app://com.nhn.android.search/', 'naver-other', 'app-referrer'],
    ['android-app://com.nhn.android.blog/private', 'naver-blog', 'app-referrer'],
    ['android-app://com.nhn.android.nmap/', 'naver-place', 'app-referrer'],
    ['android-app://com.nhn.android.search.evil/', 'direct', 'unsupported-referrer'],
    ['android-app://private-app/', 'direct', 'unsupported-referrer'],
    ['android-app://__proto__/', 'direct', 'unsupported-referrer'],
    ['', 'direct', 'no-referrer'], ['   ', 'direct', 'no-referrer'],
    ['private-invalid', 'direct', 'invalid-referrer'],
    ['https://m.search.naver.com/?query=private-query', 'naver-search', 'web-referrer'],
    [`${origin}/works`, 'internal', 'internal'],
  ]) assert.deepEqual(visitAttribution(referrer, `${origin}/works/detail/example`), { source, basis });
  assert.deepEqual(visitAttribution('', `${origin}/works?utm_source=private-person`), { source: 'direct', basis: 'unrecognized-tag' });
  assert.deepEqual(visitAttribution('https://www.google.com/', `${origin}/works?utm_source=private-person`), { source: 'google', basis: 'web-referrer' });
  assert.deepEqual(visitAttribution('android-app://com.nhn.android.search/', `${origin}/works?utm_source=naver_blog`), { source: 'naver-blog', basis: 'link-tag' });
  assert.deepEqual(visitAttribution('', `${origin}/works?gclid=private-id`), { source: 'google-ad', basis: 'ad-tag' });
  assert.equal(isVisitBasis('private-url'), false); assert.equal(isVisitBasis('__proto__'), false);
});

test('0010 preserves all historical fields, defaults old/invalid clients to unmeasured, and rejects arbitrary evidence', async (t) => {
  const f = analyticsFixture({ seed: false, evidence: false }); t.after(() => f.db.close());
  f.entry('old', 'old-visitor', f.today, '/works/detail/sample-door', 'direct');
  const old = { ...f.db.prepare('SELECT * FROM site_visit_sessions').get() };
  f.db.exec(readFileSync(new URL('../migrations/0010_visit_source_basis.sql', import.meta.url), 'utf8'));
  assert.deepEqual({ ...f.db.prepare('SELECT * FROM site_visit_sessions').get() }, { ...old, source_basis: 'legacy' });
  assert.throws(() => f.db.prepare("UPDATE site_visit_sessions SET source_basis='private-person'").run(), /CHECK/);
  for (const basis of [undefined, 'private-query', { url: 'secret' }, '__proto__']) {
    assert.equal((await collector({ request: request({ path: '/works', source: 'google', basis }), env: f.env })).status, 204);
  }
  assert(f.db.prepare('SELECT source_basis FROM site_visit_sessions').all().every(row => row.source_basis === 'legacy'));
  assert.deepEqual({ ...f.db.prepare("SELECT * FROM site_visit_sessions WHERE session_id='old'").get() }, { ...old, source_basis: 'legacy' });
});

test('new evidence survives session reuse; owner, DNT and bots never enter either table', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  const first = await collector({ request: request({ path: '/works', ...visitAttribution('', `${origin}/works?utm_source=after_call&utm_medium=sms`) }), env: f.env });
  const before = JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all());
  await collector({ request: request({ path: '/works/detail/sample-door', source: 'internal', basis: 'internal' }, cookies(first)), env: f.env });
  await collector({ request: request({ path: '/works', source: 'google', basis: 'web-referrer' }, cookies(first)), env: f.env });
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all()), before);
  assert.equal(f.db.prepare('SELECT source_basis FROM site_visit_sessions').get().source_basis, 'link-tag');
  const queryCount = f.queries.length;
  for (const [cookie, headers] of [['acedent_owner_excluded=1', {}], ['', { DNT: '1' }], ['', { 'User-Agent': 'Googlebot' }]]) {
    const result = await collector({ request: request({ path: '/works', source: 'direct', basis: 'no-referrer' }, cookie, headers), env: f.env });
    assert.equal(result.status, 204); assert.equal(result.headers.get('set-cookie'), null);
  }
  assert.equal(f.queries.length, queryCount);
});

test('missing 0010 still records sessions and exposes hourly aggregates without claiming zero/missing referrers', async (t) => {
  const f = analyticsFixture({ seed: false, evidence: false }); t.after(() => f.db.close());
  const access = await accessFixture(t); Object.assign(f.env, access.env);
  const result = await collector({ request: request({ path: '/works', source: 'naver-other', basis: 'app-referrer' }), env: f.env });
  assert.equal(result.status, 204); assert.match(cookies(result), /acedent_visit_session=/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM site_visit_sessions').get().n, 1);
  const data = await (await admin({ request: await access.request('/admin/api/analytics?period=today'), env: f.env })).json();
  assert.equal(data.acquisition.available, true); assert.equal(data.acquisition.total, 1);
  assert.equal(data.acquisition.hours.reduce((sum, row) => sum + row.entries, 0), 1);
  assert.deepEqual(data.acquisition.evidence, { available: false, error: 'migration-required', rows: [] });
});

test('KST hours and evidence use the selected period and same source; read API exposes aggregates only', async (t) => {
  const f = analyticsFixture({ seed: false }); t.after(() => f.db.close());
  const access = await accessFixture(t); Object.assign(f.env, access.env);
  const { shiftAnalyticsDate } = loadTs('lib/admin-analytics.ts');
  f.entry('a', 'private-a', f.today, '/works/detail/sample-door', 'direct', 'no-referrer', 0);
  f.entry('b', 'private-b', f.today, '/works', 'naver-blog', 'link-tag', 13);
  f.entry('c', 'private-c', f.today, '/', 'direct', 'legacy', 23);
  f.entry('d', 'private-d', shiftAnalyticsDate(f.today, -1), '/', 'direct', 'unsupported-referrer', 23);
  const before = JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all());
  async function get(query) {
    const response = await admin({ request: await access.request(`/admin/api/analytics?${query}`), env: f.env });
    assert.equal(response.status, 200); return (await response.json()).acquisition;
  }
  const today = await get('period=today');
  assert.deepEqual(today.hours, [{ source: 'direct', hour: 0, entries: 1 }, { source: 'naver-blog', hour: 13, entries: 1 }, { source: 'direct', hour: 23, entries: 1 }]);
  assert.equal(today.evidence.rows.reduce((sum, row) => sum + row.entries, 0), today.total);
  assert.equal(today.evidence.rows.find(row => row.basis === 'legacy').entries, 1);
  const yesterday = await get('period=yesterday');
  assert.deepEqual(yesterday.hours, [{ source: 'direct', hour: 23, entries: 1 }]);
  assert.deepEqual(yesterday.evidence.rows, [{ source: 'direct', basis: 'unsupported-referrer', entries: 1 }]);
  assert(!/private-|visitor_hash|session_id|started_at/.test(JSON.stringify(today)));
  assert.equal((await admin({ request: new Request(`${origin}/admin/api/analytics`), env: f.env })).status, 403);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM site_visit_sessions').all()), before);
  assert(f.queries.every(q => /^\s*SELECT\b/i.test(q.sql)));
});
