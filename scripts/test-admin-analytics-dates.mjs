import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTs } from './test-support.mjs';
import { analyticsFixture } from './analytics-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const { selectedAnalyticsPeriod: period, shiftAnalyticsDate: shift } = loadTs('lib/admin-analytics.ts');
const api = loadTs('functions/admin/api/analytics.ts');
const select = (query, now = '2026-10-27T15:00:00Z') => period(new URLSearchParams(query), new Date(now));

test('today follows KST midnight; yesterday and custom dates cross month/year/leap boundaries', () => {
  assert.equal(select('period=today', '2026-10-27T14:59:59Z').start, '2026-10-27');
  assert.equal(select('period=today').start, '2026-10-28');
  assert.equal(select('period=today').isPartial, true);
  assert.equal(select('period=yesterday', '2026-01-01T00:00:00Z').start, '2025-12-31');
  assert.equal(select('date=2024-03-01').previousStart, '2024-02-29');
  assert.equal(select('date=2026-10-28').isPartial, true);
  assert.equal(select('date=2026-10-27').isPartial, false);
});

test('invalid, nonexistent and future calendar dates are rejected; existing ranges end yesterday', () => {
  for (const date of ['', '2026-02-29', '2026-02-30', '2026-13-01', '2026-1-01', 'bad', '2026-10-29']) {
    assert.throws(() => select(`date=${date}`));
  }
  for (const days of [7, 30, 90]) {
    const result = select(`days=${days}`);
    assert.equal(result.end, '2026-10-27');
    assert.equal(result.days, days);
    assert.equal(result.isPartial, false);
    assert.equal(shift(result.start, days - 1), result.end);
    assert.equal(shift(result.previousEnd, 1), result.start);
  }
});

test('real SQL keeps visitors distinct across paths, scopes all sections to the selected day, and never changes records', async (t) => {
  const f = analyticsFixture({ seed: false });
  t.after(() => f.db.close());
  const access = await accessFixture(t);
  Object.assign(f.env, access.env);
  const yesterday = shift(f.today, -1);
  const earlier = shift(f.today, -2);
  f.visit('a', f.today, '/', 2);
  f.visit('a', f.today, '/works/detail/sample-door', 3);
  f.visit('b', f.today, '/works/detail/sample-door', 1);
  f.visit('a', yesterday, '/works/detail/sample-bumper', 7);
  f.visit('b', earlier, '/works', 4);
  const snapshot = JSON.stringify(f.db.prepare('SELECT * FROM site_visit_daily ORDER BY visit_date, path, visitor_hash').all());
  async function get(query) {
    const response = await api.onRequestGet({ request: await access.request(`/admin/api/analytics?${query}`), env: f.env });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control'), /private.*no-store/);
    return response.json();
  }
  const today = await get('period=today');
  assert.deepEqual([today.period.visitors, today.period.views, today.period.comparable, today.period.isPartial], [2, 6, false, true]);
  assert.equal(today.topPages.find(p => p.path.endsWith('/sample-door')).views, 4);
  assert.equal(today.topPages.find(p => p.path.endsWith('/sample-bumper')).views, 0);
  assert.deepEqual(today.pageGroups.map(g => [g.type, g.visitors, g.views]), [['detail', 2, 4], ['home', 1, 2]]);
  assert.deepEqual(today.daily, [{ date: f.today, visitors: 2, views: 6 }]);
  assert.equal(today.stats.todayViews, 6);
  assert.equal(today.stats.weekViews, 11); // Still complete days, never selection-dependent.
  assert.equal(today.topPages.filter(p => p.type === 'detail').length, 6);
  assert.equal(today.today, f.today);
  assert(!Number.isNaN(Date.parse(today.generatedAt)));
  const yesterdayResult = await get('period=yesterday');
  assert.equal(yesterdayResult.period.views, 7);
  assert.equal(yesterdayResult.period.previousViews, 4);
  assert.equal(yesterdayResult.period.isPartial, false);
  assert.deepEqual((await get(`date=${yesterday}`)).period, yesterdayResult.period);
  const old = await get(`date=${shift(f.today, -50)}`);
  assert.equal(old.period.views, 0);
  assert.equal(old.period.comparable, false);
  for (const days of [7, 30, 90]) {
    const range = await get(`days=${days}`);
    assert.equal(range.period.visitors, 2);
    assert.equal(range.period.views, 11);
  }
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM site_visit_daily ORDER BY visit_date, path, visitor_hash').all()), snapshot);
  assert(f.queries.every(q => /^\s*SELECT\b/i.test(q.sql)));
});

test('authentication, invalid-date rejection and administrator exclusion cookie remain intact', async (t) => {
  const f = analyticsFixture({ seed: false });
  t.after(() => f.db.close());
  const access = await accessFixture(t);
  Object.assign(f.env, access.env);
  const unauth = await api.onRequestGet({ request: new Request('https://www.acedentshop.co.kr/admin/api/analytics?period=today'), env: f.env });
  assert.equal(unauth.status, 403);
  const invalid = await api.onRequestGet({ request: await access.request('/admin/api/analytics?date=2026-02-30'), env: f.env });
  assert.equal(invalid.status, 400);
  assert.equal(f.queries.length, 0);
  const owner = await api.onRequestPost({ request: await access.request('/admin/api/analytics'), env: f.env });
  assert.match(owner.headers.get('Set-Cookie'), /acedent_owner_excluded=1; Path=\/; Max-Age=31536000; SameSite=Lax; Secure/);
  const collect = loadTs('functions/api/visit.ts').onRequestPost;
  const excluded = await collect({ request: new Request('https://www.acedentshop.co.kr/api/visit', {
    method: 'POST', headers: { Cookie: 'acedent_owner_excluded=1', 'Content-Type': 'application/json' }, body: JSON.stringify({ path: '/works' }),
  }), env: f.env });
  assert.equal(excluded.status, 204);
  assert.equal(f.queries.length, 0);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS count FROM site_visit_daily').get().count, 0);
});
