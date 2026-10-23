// Offline fixtures + optional built-HTML checks; no credentials or operational writes.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadTs, fixtureDatabase } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const { normalizeWorkPartName: name, normalizeWorkPartTaxonomy: normalize, SPARE_TIRE_COVER: cover } = loadTs('lib/work-part-taxonomy.ts');
const { WORK_PART_FILTER_ORDER } = loadTs('content/works/types.ts');
const { getWorkPartsForCategory: partsFor, getWorkRepresentativePart: photo, getWorkFilterCategories: categories } = loadTs('lib/work-categories.ts');
const { getWorkPartLandings: landings, getWorkPartLandingWorks: matching } = loadTs('lib/work-landings.ts');
const { getLegacyWheelRedirect: redirect, readWorkFilters, getLegacyWorksRedirect } = loadTs('lib/work-routes.ts');
const { getWorksMetadata, getWorkMetadata } = loadTs('lib/work-metadata.ts');
const { formatWorkCardParts } = loadTs('lib/work-parts.ts');
const { createWorkSlugAnalysis } = loadTs('functions/_shared/work-slug.ts');
const { getWorkForEdit } = loadTs('functions/_shared/work-edit.ts');
const rawRecords = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url))).records;
const base = rawRecords[0].work;
const legacy = [
  ['mercedes-benz-g-g450d-side-wheel-panel-paint', '휠 커버 측면', 'dent'],
  ['mercedes-g-g450d-wheel-panel-paint', '휠 스페어타이어 휠커버', 'panel-paint'],
  ['mercedes-benz-g-class-g450d-wheel-panel-paint', '휠 스페어타이어 휠커버', 'panel-paint'],
  ['mercedes-g63-wheel-cover-paint', '휠 후면 스페어타이어 휠커버', undefined],
  ['mercedes-g-dent', '스페어타이어 휠커버', undefined],
];
const media = (part, category, label = part) => ({ ...base.parts[0], part: [part], label, category, before: `/works/${category || 'legacy'}-${part}-before.jpg` });
const fixtures = legacy.map(([slug, label, category], index) => ({
  ...base, slug, category: index === 4 ? 'dent' : 'panel-paint', subCategories: [], subParts: [],
  part: index === 4 ? ['휠', '스페어타이어 휠커버'] : ['휠'],
  parts: [media('휠', category, label), ...(index === 2 ? [media('차량 전체', 'full-polish')] : [])],
}));
fixtures.push({ ...base, slug: 'new-cover', category: 'panel-paint', subCategories: [], subParts: [], part: ['스페어 타이어 커버'], parts: [media('스페어 타이어 커버', 'panel-paint')] });
const works = fixtures.map(normalize);
const chips = (items, category) => WORK_PART_FILTER_ORDER.filter(part => items.some(work => partsFor(work, category).includes(part)));

test('six covers merge, wheel hides, and another repair PART stays separate', () => {
  assert.equal(matching(works, undefined, cover).length, 6);
  assert.equal(matching(works, 'panel-paint', cover).length, 4);
  assert.equal(matching(works, 'dent', cover).length, 2);
  assert.equal(matching(works, 'full-polish', cover).length, 0);
  assert.equal(matching(works, 'full-polish', '차량 전체').length, 1);
  assert(chips(works).includes(cover));
  assert(!chips(works).includes('휠'));
  assert.deepEqual(chips(works, 'full-polish'), ['차량 전체']);
  assert.equal(formatWorkCardParts(works[4]), cover);
  assert.equal(photo(works[2], 'panel-paint', cover), works[2].parts[0]);
  assert.equal(photo(works[2], 'full-polish', '차량 전체'), works[2].parts[1]);
});

test('normalization is nonmutating, idempotent, and preserves URLs/methods/assets/text', () => {
  const before = JSON.stringify(fixtures);
  fixtures.forEach((original, index) => {
    const updated = normalize(original);
    assert.deepEqual(normalize(updated), updated);
    const omitParts = ({ part, parts, ...rest }) => rest;
    assert.deepEqual(omitParts(updated), omitParts(original));
    original.parts.forEach((part, i) => {
      const omitTaxonomy = ({ part, label, ...rest }) => rest;
      assert.deepEqual(omitTaxonomy(updated.parts[i]), omitTaxonomy(part));
    });
    assert.deepEqual(categories(updated), categories(original));
    assert.equal(getWorkMetadata(updated).canonical, getWorkMetadata(original).canonical);
    assert.equal(getWorkMetadata(updated).image, getWorkMetadata(original).image);
    assert.equal(updated.slug, fixtures[index].slug);
  });
  assert.equal(JSON.stringify(fixtures), before);
});

test('only exact synonyms and confirmed first PARTs convert, never arbitrary wheels', () => {
  for (const alias of [cover, '스페어 타이어 커버', '스페어타이어 휠커버']) assert.equal(name(alias), cover);
  for (const other of ['휠', '휠커버', '휠하우스', '타이어', '앞범퍼']) assert.equal(name(other), other);
  const wheel = { ...fixtures[0], slug: 'actual-wheel', parts: [media('휠', 'polish', '휠 림 흠집')] };
  assert.equal(normalize(wheel).parts[0].part[0], '휠');
  assert.equal(normalize({ ...wheel, slug: fixtures[0].slug }).parts[0].part[0], '휠');
  const extraWheel = normalize({ ...fixtures[0], parts: [...fixtures[0].parts, media('휠', 'polish')] });
  assert.equal(extraWheel.parts[1].part[0], '휠');
  assert(chips([...works, wheel]).includes('휠'));
  assert.equal(redirect('/works', '?part=휠', [...works, wheel]), undefined);
});

test('canonical/OG landings use the correct cover PART; thin landing is not emitted', () => {
  const paths = landings(works).map(x => x.path);
  assert(paths.includes('/works/panel-paint/spare-tire-cover'));
  assert(!paths.includes('/works/dent/spare-tire-cover'));
  assert(!paths.some(path => path.endsWith('/wheel')));
  const metadata = getWorksMetadata('panel-paint', cover, works);
  assert.equal(metadata.canonical, 'https://www.acedentshop.co.kr/works/panel-paint/spare-tire-cover');
  assert(metadata.title.includes(cover));
  assert(metadata.image.includes('panel-paint'));
  assert(metadata.imageAlt.includes('수리 전'));
  assert(!metadata.image.includes('full-polish'));
});

test('old wheel paths/queries stay usable, unrelated filters and UTM are preserved', () => {
  const target = redirect('/works/panel-paint/wheel', '?utm_source=test&part=휠', works);
  assert(target.startsWith('/works/panel-paint/spare-tire-cover?'));
  const query = new URL(target, 'https://example.com').searchParams;
  assert.equal(query.get('part'), cover);
  assert.equal(query.get('utm_source'), 'test');
  assert.equal(readWorkFilters('/works', '?part=스페어 타이어 커버').part, cover);
  assert.equal(readWorkFilters('/works/panel-paint/spare-tire-cover', '?part=휠').part, cover);
  const firstHop = getLegacyWorksRedirect('/works', '?category=판금도색&part=휠&utm_source=test');
  const oldUrl = new URL(firstHop, 'https://example.com');
  assert.equal(redirect(oldUrl.pathname, oldUrl.search, works), target);
  assert.equal(redirect('/works/panel-paint', '?part=도어', works), undefined);
  assert.equal(redirect('/admin', '?part=휠', works), undefined);
  assert.equal(redirect('/works/detail/anything', '?part=휠', works), undefined);
  assert.equal(redirect('/works/full-polish', '?part=휠', works), undefined);
});

test('edit GET uses same adapter without any DB writes or category backfill', async () => {
  let reads = 0;
  const original = fixtures[3];
  const env = { ACEDENT_DB: { prepare(sql) {
    assert(sql.startsWith('SELECT ')); reads++;
    return { bind() { return this; }, async first() { return { payload_json: JSON.stringify(original), status: 'published' }; }, async all() { return { results: [] }; } };
  } } };
  const response = await getWorkForEdit(env, original.slug);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.work.parts[0].part[0], cover);
  assert.equal(result.work.parts[0].category, undefined);
  assert.equal(result.work.slug, original.slug);
  assert.equal(reads, 2);
});

test('future slugs recognize the new part; existing slugs are not regenerated', () => {
  const result = createWorkSlugAnalysis({ carMaker: '벤츠', carModel: 'G400d', category: '판금도색', parts: [{ part: [cover] }] });
  assert(result.slug.includes('spare-tire-cover'));
  assert.deepEqual(result.excludedTerms, []);
});

test('authenticated admin list uses the same cover names without rewriting stored rows', async t => {
  const { db, env } = fixtureDatabase();
  const access = await accessFixture(t);
  Object.assign(env, access.env);
  const work = fixtures[0];
  const payload = JSON.stringify(work);
  try {
    db.prepare('INSERT INTO works VALUES (?, ?, ?, ?, ?, ?, ?)').run(work.slug, work.date, work.category, 'published', payload, work.date, work.date);
    const result = await loadTs('functions/admin/api/works.ts').onRequestGet({ request: await access.request('/admin/api/works'), env });
    assert.equal(result.status, 200);
    const list = await result.json();
    const row = list.works.find(item => item.slug === work.slug);
    assert.deepEqual(row.parts, [cover]);
    assert.deepEqual(row.categories, categories(work));
    assert.equal(db.prepare('SELECT payload_json FROM works WHERE slug = ?').get(work.slug).payload_json, payload);
  } finally { db.close(); }
});

const distIndex = process.argv.indexOf('--dist');
if (distIndex >= 0) test('built HTML and live-snapshot parsing agree, with compatible redirects/sitemap', () => {
  const dist = resolve(process.argv[distIndex + 1]);
  const parsed = loadTs('lib/works.ts').getWorks();
  const expected = matching(parsed, 'panel-paint', cover);
  assert(expected.length >= 3);
  const path = '/works/panel-paint/spare-tire-cover';
  const html = readFileSync(resolve(dist, path.slice(1) + '.html'), 'utf8');
  const metadata = getWorksMetadata('panel-paint', cover, parsed);
  assert(html.includes(`rel="canonical" href="${metadata.canonical}"`));
  assert(html.includes(`property="og:image" content="${metadata.image}"`));
  const cardSlugs = [...html.matchAll(/<a\b[^>]*\bhref="\/works\/detail\/([^"?]+)"[^>]*>/g)].map(m => m[1]);
  assert.equal(new Set(cardSlugs).size, expected.length);
  for (const item of expected) assert(cardSlugs.includes(item.slug));
  for (const item of parsed) assert(existsSync(resolve(dist, `works/detail/${item.slug}.html`)));
  const sitemap = readFileSync(resolve(dist, 'sitemap.xml'), 'utf8');
  assert(sitemap.includes(`<loc>${metadata.canonical}</loc>`));
  assert(!sitemap.includes('/works/panel-paint/wheel</loc>'));
  assert(!sitemap.includes('/works/dent/spare-tire-cover</loc>'));
  const redirects = readFileSync(resolve(dist, '_redirects'), 'utf8');
  assert(redirects.includes('/works/panel-paint/wheel /works/panel-paint/spare-tire-cover?'));
  assert(redirects.includes('/google1aaf01d6d5541d0d.html /google1aaf01d6d5541d0d 302'));
  console.log(JSON.stringify({ snapshotCases: parsed.length, covers: matching(parsed, undefined, cover).length, panelCovers: expected.length, dentCovers: matching(parsed, 'dent', cover).length, wheel: matching(parsed, undefined, '휠').length, canonical: metadata.canonical, og: metadata.image }));
});
