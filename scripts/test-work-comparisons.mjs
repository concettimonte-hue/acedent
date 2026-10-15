// Only in-memory D1/R2 and local signatures. Never writes operating cases/photos.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const base = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8')).records[0].work;
const pair = { before: '/works/extra-before.jpg', after: '/works/extra-after.jpg', caption: '측면 다른 각도' };
const marks = [{ type: 'arrow', startX: 0.1, startY: 0.3, endX: 0.4, endY: 0.5 },
  { type: 'circle', x: 0.3, y: 0.4, width: 0.15, height: 0.2 }];
const work = { ...base, parts: [{ ...base.parts[0], comparisons: [pair] }, ...base.parts.slice(1)] };
const helpers = loadTs('lib/work-comparisons.ts');
const images = loadTs('lib/work-images.ts');

await test('optional comparisons: limits, complete pair, safe references, optional captions', () => {
  const parse = value => helpers.normalizeComparisons(value, helpers.comparisonImageUrl);
  assert.deepEqual(parse(undefined), []);
  assert.deepEqual(parse([pair]), [pair]);
  assert.equal(parse([{ ...pair, caption: '  ' }])[0].caption, undefined);
  for (const value of [null, {}, [null], [{ before: pair.before }], [{ ...pair, after: 'javascript:alert(1)' }], Array(4).fill(pair), [{ ...pair, caption: 'a'.repeat(121) }]]) assert.throws(() => parse(value));
  helpers.validateComparisonTotal([{ comparisons: Array(3) }, { comparisons: Array(3) }]);
  assert.throws(() => helpers.validateComparisonTotal([{ comparisons: Array(3) }, { comparisons: Array(3) }, { comparisons: [pair] }]));
  assert.throws(() => helpers.comparisonAssetReference({ key: 'works/../outside.jpg' }, 'image'));
});

await test('filters, recommendations, slug, card and OG selection are invariant', () => {
  const { getWorkFilterParts } = loadTs('lib/work-parts.ts');
  const { getWorkFilterCategories } = loadTs('lib/work-categories.ts');
  const { selectRelatedWorkSuggestions } = loadTs('lib/work-related.ts');
  assert.deepEqual(getWorkFilterParts(work), getWorkFilterParts(base));
  assert.deepEqual(getWorkFilterCategories(work), getWorkFilterCategories(base));
  for (const name of ['getWorkOgImageSrc', 'getWorkThumbnailSrc', 'getWorkCardImageSrcForCategory']) assert.equal(images[name](work), images[name](base));
  const allWorks = loadTs('lib/works.ts').getWorks();
  assert.deepEqual(selectRelatedWorkSuggestions(allWorks, work), selectRelatedWorkSuggestions(allWorks, base));
  const { createBaseWorkSlug } = loadTs('functions/_shared/work-slug.ts');
  const input = { ...base, parts: base.parts.map(p => ({ ...p, detail: p.label })) };
  assert.equal(createBaseWorkSlug(input), createBaseWorkSlug({ ...input, parts: input.parts.map(p => ({ ...p, comparisons: [pair] })) }));
});

await test('comparison marks are optional, independently validated and rendered without inheriting parent marks', () => {
  const parse = value => helpers.normalizeComparisons(value, helpers.comparisonImageUrl);
  assert.equal(parse([pair])[0].beforeAnnotations, undefined);
  assert.deepEqual(parse([{ ...pair, beforeAnnotations: marks }])[0].beforeAnnotations, marks);
  assert.deepEqual(parse([{ ...pair, beforeAnnotations: [] }])[0].beforeAnnotations, []);
  for (const bad of [{}, Array(4).fill(marks[0]), [{ ...marks[0], endX: 2 }], [{ type: 'script' }]]) {
    assert.throws(() => parse([{ ...pair, beforeAnnotations: bad }]));
  }
  const Component = loadTs('components/WorkAdditionalComparisons.tsx').default;
  const render = comparisons => renderToStaticMarkup(createElement(Component, {
    work, part: { ...work.parts[0], beforeAnnotations: marks, comparisons },
  }));
  assert(!render([pair]).includes('work-image-annotations'), 'parent marks must not leak into another angle');
  const html = render([{ ...pair, beforeAnnotations: marks }, pair]);
  assert.equal((html.match(/class="work-image-annotations"/g) || []).length, 1);
  assert.equal((html.match(/work-image-annotation-mark/g) || []).length, 2);
});

await test('React/static HTML/JSON-LD use same ALT; captions escaped; no extra PART or category', () => {
  const Component = loadTs('components/WorkAdditionalComparisons.tsx').default;
  const { getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
  const { getWorkImageJsonLd } = loadTs('lib/work-metadata.ts');
  const example = { ...work, parts: [{ ...work.parts[0], category: undefined, comparisons: [{ ...pair, caption: '<script>test</script>' }, { ...pair, caption: undefined }] }] };
  const react = renderToStaticMarkup(createElement(Component, { work: example, part: example.parts[0] }));
  const html = getWorkDetailStaticHtml(example, [], 0, [example]);
  assert(react.includes('&lt;script&gt;test&lt;/script&gt;'));
  assert(html.includes('&lt;script&gt;test&lt;/script&gt;'));
  assert.equal((react.match(/<figcaption>/g) || []).length, 1);
  assert.equal((react.match(/role="slider"/g) || []).length, 2);
  assert.equal((html.match(/PART 01/g) || []).length, 1);
  assert(!html.includes('PART 02'));
  const alt = images.getWorkComparisonImageAlt(example, example.parts[0], example.parts[0].comparisons[1], '전');
  assert(!alt.includes('판금도색'));
  assert(react.includes(alt)); assert(html.includes(alt));
  const extra = getWorkImageJsonLd(example)['@graph'].filter(i => i.contentUrl.endsWith('/extra-before.jpg'));
  assert.equal(extra.length, 2);
  assert(extra.every(i => i.representativeOfPage === false));
  assert.equal(extra[1].name, alt);
  assert.equal(renderToStaticMarkup(createElement(Component, { work: base, part: { ...base.parts[0], comparisons: undefined } })), '');
});

await test('sync validates and normalizes nested comparison images without changing old records', () => {
  const source = readFileSync(new URL('./sync-works.mjs', import.meta.url), 'utf8');
  // Trusted repository function only; do not execute env loading, fetch or file output.
  // oxlint-disable-next-line typescript/no-implied-eval
  const validate = new Function(`const workCategories = new Set(['dent','panel-paint','partial-paint','replace-paint','polish','full-polish','coating']); const galleryMaxPerScope=6, galleryMaxTotal=12, comparisonMaxPerPart=3, comparisonMaxTotal=6; const workPartPositions = new Set(['front','rear']); ${source.slice(source.indexOf('function validateWork('), source.indexOf('function localRecords('))}; return validateWork;`)();
  assert.deepEqual(validate(structuredClone(work), 'fixture').parts[0].comparisons, [pair]);
  const annotated = structuredClone(work);
  annotated.parts[0].comparisons[0].beforeAnnotations = marks;
  assert.deepEqual(validate(annotated, 'fixture').parts[0].comparisons[0].beforeAnnotations, marks);
  assert.deepEqual(helpers.normalizeComparisons(annotated.parts[0].comparisons, helpers.comparisonImageUrl)[0].beforeAnnotations, marks);
  const old = structuredClone(base);
  delete old.parts[0].comparisons;
  assert.equal(validate(old, 'fixture').parts[0].comparisons, undefined);
  const bad = structuredClone(work); bad.parts[0].comparisons[0].after = '';
  assert.throws(() => validate(bad, 'fixture'));
  // oxlint-disable-next-line typescript/no-implied-eval
  const normalize = new Function('process', `const legacyR2PublicBases=['https://old.example']; const wranglerPublicBase=()=>''; ${source.slice(source.indexOf('function normalizeR2Url('), source.indexOf('async function d1Records('))}; return normalizeWorkImageUrls;`)({ env: { R2_PUBLIC_BASE_URL: 'https://images.example/' } });
  const input = structuredClone(work); input.parts[0].comparisons[0].before = 'https://old.example/works/extra-before.jpg';
  assert.equal(normalize(input).parts[0].comparisons[0].before, 'https://images.example/works/extra-before.jpg');
});

function database() {
  const db = new DatabaseSync(':memory:');
  for (const file of ['0001_admin_content.sql', '0003_admin_cleanup_queue.sql', '0005_work_secondary_tags.sql', '0007_work_og_image_asset.sql']) db.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  const binding = {
    prepare(sql) {
      const stmt = db.prepare(sql); let args = [];
      return { bind(...values) { args = values; return this; }, async all() { return { results: stmt.all(...args) }; }, async first() { return stmt.get(...args) ?? null; }, async run() { return stmt.run(...args); } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const stmt of statements) results.push(await stmt.run()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, binding };
}

function preservationFixture(t) {
  const { db, binding } = database(); t.after(() => db.close());
  const slug = 'local-preservation';
  const root = 'https://images.example/';
  const keys = ['main-before', 'main-after', 'main-thumbnail', 'comparison-before', 'comparison-after']
    .map(name => `works/local-preservation/${name}.jpg`);
  const [before, after, thumbnail, extraBefore, extraAfter] = keys.map(key => ({ key }));
  const part = { part: ['도어'], label: '도어', note: '로컬 보존 검사', before, after, thumbnail,
    comparisons: [{ before: extraBefore, after: extraAfter, caption: '다른 각도' }] };
  const input = { date: '2026-10-15', title: '도어 복원', carMaker: '기아', carModel: 'K5', color: '회색',
    category: 'panel-paint', days: '1일', summary: '요약', body: '설명', parts: [part] };
  const stored = { ...base, ...input, slug, ogImage: undefined, gallery: [], subCategories: [], subParts: [], part: ['도어'],
    parts: [{ ...part, before: root + before.key, after: root + after.key, thumbnail: root + thumbnail.key,
      comparisons: [{ before: root + extraBefore.key, after: root + extraAfter.key, caption: '다른 각도' }] }] };
  db.prepare('INSERT INTO works (slug, date, category, payload_json, status, created_by_email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(slug, input.date, input.category, JSON.stringify(stored), 'published', 'test@example.test', input.date, input.date);
  for (const key of keys) {
    const kind = key.includes('thumbnail') ? 'thumbnail' : key.includes('before') ? 'before' : 'after';
    db.prepare('INSERT INTO work_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(key, slug, root + key, kind, 0, kind === 'thumbnail' ? 800 : 1600, kind === 'thumbnail' ? 600 : 1200, 1000, input.date);
  }
  const env = { ACEDENT_DB: binding, R2_PUBLIC_BASE_URL: root,
    ACEDENT_IMAGES: { async head() { throw new Error('Existing references need no R2 write/read'); }, async delete() { throw new Error('No actual deletion'); } } };
  return { db, env, slug, input, keys };
}

await test('preservation: stale form omitting comparisons cannot silently discard saved pairs', async t => {
  const { db, env, slug, input } = preservationFixture(t);
  const { updateWork } = loadTs('functions/_shared/work-edit.ts');
  const previous = db.prepare('SELECT payload_json FROM works').get().payload_json;
  const stale = structuredClone(input); delete stale.parts[0].comparisons;
  const response = await updateWork(env, slug, stale);
  assert.equal(response.status, 409, 'old form must reload instead of clearing unrecognized comparisons');
  assert.equal(db.prepare('SELECT payload_json FROM works').get().payload_json, previous);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 0);
  // An explicit [] remains a supported deletion. Legacy cases without pairs still save.
  assert.equal((await updateWork(env, slug, { ...input, parts: [{ ...input.parts[0], comparisons: [] }] })).status, 200);
  assert.equal((await updateWork(env, slug, stale)).status, 200);
});

await test('preservation: reused comparison keys leave cleanup queue before deployment release', async t => {
  const { db, env, slug, input, keys } = preservationFixture(t);
  const { updateWork } = loadTs('functions/_shared/work-edit.ts');
  const removed = await updateWork(env, slug, { ...input, parts: [{ ...input.parts[0], comparisons: [] }] });
  assert.equal(removed.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 2);
  const restored = await updateWork(env, slug, input);
  assert.equal(restored.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 0, 'active image must no longer be marked for replacement cleanup');
  const auth = await accessFixture(t);
  const release = loadTs('functions/admin/api/orphans.ts').onRequestPost;
  const request = new Request('https://www.acedentshop.co.kr/admin/api/orphans', {
    method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': await auth.token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ releaseWorkSlug: slug }),
  });
  const response = await release({ request, env: { ...env, ...auth.env } });
  assert.equal(response.status, 200); assert.equal((await response.json()).released, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM work_assets').get().n, keys.length);
});

await test('comparison marks survive edit/read and reject a stale editor; explicit clearing remains supported', async t => {
  const { db, env, slug, input } = preservationFixture(t);
  const { updateWork, getWorkForEdit } = loadTs('functions/_shared/work-edit.ts');
  const marked = structuredClone(input);
  marked.parts[0].comparisons[0].beforeAnnotations = marks;
  const saved = await updateWork(env, slug, marked);
  assert.equal(saved.status, 200);
  assert.deepEqual((await saved.json()).work.parts[0].comparisons[0].beforeAnnotations, marks);
  assert.deepEqual((await (await getWorkForEdit(env, slug)).json()).work.parts[0].comparisons[0].beforeAnnotations, marks);
  const snapshot = db.prepare('SELECT payload_json FROM works').get().payload_json;
  assert.equal((await updateWork(env, slug, input)).status, 409);
  assert.equal(db.prepare('SELECT payload_json FROM works').get().payload_json, snapshot);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 0);
  const invalid = structuredClone(marked); invalid.parts[0].comparisons[0].beforeAnnotations[0].endX = 2;
  assert.equal((await updateWork(env, slug, invalid)).status, 400);
  assert.equal(db.prepare('SELECT payload_json FROM works').get().payload_json, snapshot);
  marked.parts[0].comparisons[0].beforeAnnotations = [];
  const cleared = await updateWork(env, slug, marked);
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).work.parts[0].comparisons[0].beforeAnnotations, undefined);
});

await test('actual upload/create/read/update/delete APIs register all pair assets and hold cleanup until deployment', async t => {
  const auth = await accessFixture(t);
  const { db, binding } = database(); t.after(() => db.close());
  const objects = new Map();
  const env = { ...auth.env, ACEDENT_DB: binding, R2_PUBLIC_BASE_URL: 'https://images.example', ACEDENT_IMAGES: {
    async head(key) { return objects.get(key) || null; },
    async put(key, bytes, options) { objects.set(key, options); },
    async delete() { throw new Error('No direct photo deletion is allowed in save/update'); },
  } };
  const uploadId = 'local-test-upload';
  const request = async (body, path = '/admin/api/works', method = 'POST') => new Request(`https://www.acedentshop.co.kr${path}`, { method: method === 'PUT' ? 'PUT' : method === 'DELETE' ? 'DELETE' : 'POST', headers: { 'Cf-Access-Jwt-Assertion': await auth.token(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const imageBytes = readFileSync(new URL('../public/works/jeep-renegade-door-dent-before.jpg', import.meta.url));
  const uploadApi = loadTs('functions/admin/api/images.ts').onRequestPost;
  const upload = async (name, kind) => {
    const form = new FormData(); form.append('file', new File([imageBytes], 'local.jpg', { type: 'image/jpeg' }));
    for (const [key, value] of Object.entries({ uploadId, name, kind, partIndex: '0' })) form.append(key, value);
    const response = await uploadApi({ env, request: new Request('https://www.acedentshop.co.kr/admin/api/images', { method: 'POST', headers: { 'Cf-Access-Jwt-Assertion': await auth.token() }, body: form }) });
    assert.equal(response.status, 201, await response.clone().text());
    return response.json();
  };
  const before = await upload('image', 'before');
  const after = await upload('image', 'after');
  const extraBefore = await upload('comparison-local-one', 'before');
  const extraAfter = await upload('comparison-local-one', 'after');
  assert.notEqual(extraBefore.key, before.key);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 4, 'uploads await final save; failed saves retain cleanup');
  const asset = (kind, width, height) => {
    const key = `works/${uploadId}/fixture-${kind}.jpg`;
    objects.set(key, { customMetadata: { kind, width: String(width), height: String(height), bytes: '1000' } });
    return { key };
  };
  const part = { part: ['도어'], detail: '조수석', note: '로컬 테스트', before, after, thumbnail: asset('thumbnail', 800, 600), comparisons: [{ before: extraBefore, after: extraAfter, caption: '다른 각도', beforeAnnotations: marks }] };
  const input = { uploadId, date: '2026-10-15', carMaker: 'BMW', carModel: '530i', color: '검정', category: 'panel-paint', days: '2일', title: '도어 복원', summary: '로컬 테스트 요약', body: '로컬 테스트 설명', parts: [part], ogImage: asset('og-image', 1200, 630) };
  const create = loadTs('functions/admin/api/works.ts').onRequestPost;
  const failed = await create({ env, request: await request({ ...input, parts: [{ ...part, comparisons: [{ before: extraBefore }] }] }) });
  assert.equal(failed.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM works').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 4);
  for (const parts of [[{ ...part, comparisons: Array(4).fill(part.comparisons[0]) }], Array(3).fill({ ...part, comparisons: Array(3).fill(part.comparisons[0]) })]) {
    const limitResponse = await create({ env, request: await request({ ...input, parts }) });
    assert.equal(limitResponse.status, 400, 'API enforces per-PART and whole-case caps');
  }
  const result = await create({ env, request: await request(input) });
  assert.equal(result.status, 201, await result.clone().text());
  const saved = (await result.json()).work;
  assert.equal(saved.parts.length, 1); assert.equal(saved.parts[0].category, undefined);
  assert.equal(saved.parts[0].comparisons[0].before, extraBefore.url);
  assert.deepEqual(saved.parts[0].comparisons[0].beforeAnnotations, marks);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM work_assets').get().n, 6);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 0);
  const api = loadTs('functions/admin/api/works/[slug].ts');
  const context = { env, params: { slug: saved.slug } };
  const read = await api.onRequestGet({ ...context, request: await auth.request(`/admin/api/works/${saved.slug}`) });
  assert.deepEqual((await read.json()).work.parts[0].comparisons, saved.parts[0].comparisons);
  const edit = async body => api.onRequestPut({ ...context, request: await request(body, `/admin/api/works/${saved.slug}`, 'PUT') });
  const rejected = await edit({ ...input, parts: [{ ...part, comparisons: [{ before: { key: 'works/other-case/private-before.jpg' }, after: extraAfter }] }] });
  assert.equal(rejected.status, 400, 'cannot attach another case image');
  const extra2Before = await upload('comparison-local-two', 'before');
  const extra2After = await upload('comparison-local-two', 'after');
  const pairs = [{ before: extra2Before, after: extra2After, caption: '두 번째를 앞으로' }, ...part.comparisons];
  const added = await edit({ ...input, parts: [{ ...part, comparisons: pairs }] });
  assert.equal(added.status, 200, await added.clone().text());
  assert.equal((await added.json()).work.parts[0].comparisons[0].caption, '두 번째를 앞으로');
  const removed = await edit({ ...input, parts: [{ ...part, comparisons: pairs.slice(0, 1) }] });
  const removedBody = await removed.json();
  assert.equal(removed.status, 200); assert.equal(removedBody.cleanupPending, 2);
  assert.equal(removedBody.work.slug, saved.slug);
  assert.equal(removedBody.work.ogImage, saved.ogImage);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM work_assets').get().n, 8, 'old images held before deployment');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue WHERE operation = ?').get('replace-asset').n, 2);
  const release = loadTs('functions/admin/api/orphans.ts').onRequestPost;
  const released = await release({ env, request: await request({ releaseWorkSlug: saved.slug }, '/admin/api/orphans') });
  assert.equal(released.status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM work_assets').get().n, 6);
  const deleted = await api.onRequestDelete({ ...context, request: await request({}, `/admin/api/works/${saved.slug}`, 'DELETE') });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).assetCount, 6, 'whole-case deletion includes comparison images');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue WHERE operation = ?').get('delete-work').n, 6);
  assert.equal(db.prepare('SELECT status FROM works').get().status, 'draft');
});
