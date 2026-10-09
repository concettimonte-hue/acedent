import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { loadTs, fixtureDatabase, localRequest } from './test-support.mjs';

const { matchesAdminSearch, paginateAdminRows } = loadTs('lib/admin-list.ts');
const { analyticsPeriod } = loadTs('lib/admin-analytics.ts');
const { selectRelatedWorkSuggestions: recommend } = loadTs('lib/work-related.ts');
const { getWorkCardImageSrcForCategory: cardImage } = loadTs('lib/work-images.ts');
const { annotationArrowGeometry } = loadTs('lib/work-annotations.ts');
const base = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8')).records[0].work;
const part = (value, category, position) => ({ ...base.parts[0], part: [value], category, position, before: `/${value}-${position || 'unknown'}.jpg` });
const work = (slug, parts, category = 'panel-paint') => ({ ...base, slug, category, subCategories: [], part: parts[0].part, parts });

test('admin search normalizes spacing/case and pagination retains access to all 50 cases', () => {
  assert(matchesAdminSearch('bmw 530i', 'BMW', '530 i'));
  assert(matchesAdminSearch('쏘나타 도어', '현대 쏘나타', '도어 판금도색'));
  assert(!matchesAdminSearch('범퍼', '도어 판금도색'));
  const rows = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual([1, 2, 3].flatMap((page) => paginateAdminRows(rows, page).rows), rows);
  assert.equal(paginateAdminRows(rows, 99).page, 3);
  assert.equal(paginateAdminRows([], 3).page, 1);
});

test('period is complete KST days, including month/year boundaries', () => {
  assert.deepEqual(analyticsPeriod(7, new Date('2026-01-01T15:30:00Z')), { today: '2026-01-02', start: '2025-12-26', end: '2026-01-01', previousStart: '2025-12-19', previousEnd: '2025-12-25' });
});

test('analytics SQL: no top-20 cutoff, zero-record cases included, distinct visitors, today excluded', async () => {
  const { db, env, period } = fixtureDatabase();
  try {
    const response = await loadTs('functions/admin/api/analytics.ts').onRequestGet({ request: localRequest(), env });
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.topPages.filter((p) => p.type === 'detail').length, 50);
    const row = json.topPages.find((p) => p.path.endsWith('/local-test-1'));
    assert.equal(row.visitors, 2);
    assert.equal(row.views, 6);
    assert.equal(row.previousVisitors, 1);
    assert.equal(row.previousViews, 4);
    assert.equal(json.period.views, 16);
    assert.equal(json.stats.todayViews, 100);
    assert.equal(json.stats.monthViews, json.period.views);
    assert.equal(json.period.end, period.end);
    assert.equal(json.topPages.find((p) => p.path.endsWith('/local-test-50')).views, 0);
    assert.equal(json.topPages.find((p) => p.path.endsWith('/local-test-50')).registeredOn, period.today);
    const unauthenticated = await loadTs('functions/admin/api/analytics.ts').onRequestGet({ request: new Request('http://127.0.0.1/admin/api/analytics'), env });
    assert.equal(unauthenticated.status, 403);
  } finally { db.close(); }
});

test('admin listing adds real PART filters without modifying or hiding rows', async () => {
  const { db, env } = fixtureDatabase();
  try {
    const result = await loadTs('functions/admin/api/works.ts').onRequestGet({ request: localRequest('/admin/api/works'), env });
    const json = await result.json();
    assert.equal(json.works.length, 50);
    assert(json.works.every((w) => w.parts.length && w.categories.length));
  } finally { db.close(); }
});

test('recommendation: explicit position is a tie-breaker and selects the correct matching image', () => {
  const source = work('source', [part('범퍼', 'panel-paint', 'rear')]);
  const newer = work('new', [part('범퍼', 'panel-paint', 'front')]);
  const older = work('old', [part('범퍼', 'panel-paint', 'front'), part('범퍼', 'panel-paint', 'rear')]);
  const picks = recommend([source, newer, older], source);
  assert.equal(picks[0].work.slug, 'old');
  assert.equal(picks[0].matchedPartIndex, 1);
  assert.equal(cardImage(older, picks[0].matchedCategory, picks[0].matchedPart, 'before', picks[0].matchedPartIndex), '/범퍼-rear.jpg');
  assert(!picks.some((p) => p.work.slug === 'source'));
});

test('mixed-work cross matches stay part-only; legacy single-PART dent keeps compatibility', () => {
  const source = work('source', [part('휀더', 'panel-paint'), part('범퍼', 'polish')]);
  const crossed = work('cross', [part('범퍼', 'panel-paint'), part('휀더', 'polish')]);
  assert.deepEqual(recommend([crossed], source)[0].reasons, ['part']);
  const legacy = work('jeep', [part('도어', undefined)], 'dent');
  const dent = work('traverse', [part('도어', 'dent')], 'dent');
  assert.deepEqual(recommend([legacy], dent)[0].reasons, ['part', 'category']);
  const missing = work('missing', [part('도어', undefined), part('범퍼', undefined)]);
  assert.deepEqual(recommend([missing], work('door', [part('도어', 'panel-paint')]))[0].reasons, ['part']);
});

test('unknown position does not reorder exact matches; weaker same-position match cannot outrank exact work', () => {
  const source = work('source', [part('도어', 'dent')], 'dent');
  const first = work('first', [part('도어', 'dent', 'front')], 'dent');
  const second = work('second', [part('도어', 'dent', 'rear')], 'dent');
  assert.equal(recommend([first, second], source)[0].work.slug, 'first');
  source.parts[0].position = 'rear';
  const weaker = work('weak', [part('도어', 'panel-paint', 'rear')]);
  assert.equal(recommend([weaker, first], source)[0].work.slug, 'first');
});

test('arrow has a proportional open head, rounded SVG strokes and shared canvas geometry', () => {
  for (const end of [[500, 100], [100, 500], [0, 100], [120, 125]]) {
    const geometry = annotationArrowGeometry(100, 100, ...end);
    assert(!geometry.path.includes('NaN'));
    assert(geometry.markWidth < geometry.outlineWidth);
  }
  const html = renderToStaticMarkup(createElement(loadTs('components/ImageAnnotations.tsx').default, { annotations: [{ type: 'arrow', startX: .2, startY: .3, endX: .4, endY: .5 }] }));
  assert.equal((html.match(/<path/g) || []).length, 2);
  assert(!html.includes('<polygon'));
  const canvasSource = readFileSync(new URL('../components/AdminPage.tsx', import.meta.url), 'utf8');
  assert(canvasSource.includes('annotationArrowGeometry(startX, startY, endX, endY, scale)'));
});
