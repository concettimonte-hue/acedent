// Local fixtures and in-memory D1 only. No credentials, remote saves, or deploy hooks.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { loadTs } from './test-support.mjs';
import { draftDatabase } from './draft-test-fixture.mjs';

const types = loadTs('content/works/types.ts');
const categories = loadTs('lib/work-categories.ts');
const routes = loadTs('lib/work-routes.ts');
const landings = loadTs('lib/work-landings.ts');
const images = loadTs('lib/work-images.ts');
const seo = loadTs('lib/work-seo.ts');
const metadata = loadTs('lib/work-metadata.ts');
const create = loadTs('functions/admin/api/works.ts');
const edit = loadTs('functions/_shared/work-edit.ts');

function fixture(t) {
  const { db, binding } = draftDatabase();
  t.after(() => db.close());
  const objects = new Map();
  const asset = (kind) => {
    const key = `works/touchup-fixture/${kind}.jpg`;
    const size = kind === 'og-image' ? [1200, 630] : kind === 'thumbnail' ? [800, 600] : [1600, 1200];
    objects.set(key, { customMetadata: { kind, width: String(size[0]), height: String(size[1]), bytes: '1000' } });
    return { key };
  };
  const input = {
    date: '2026-10-26', uploadId: 'touchup-fixture', title: '도어 붓터치 자국 재터치업·샌딩 복원',
    carMaker: '제네시스', carModel: 'G80', color: '검정', category: 'touch-up', subCategories: [], subParts: [],
    summary: '기존 붓터치 자국을 정리하고 재터치업한 사례입니다.', body: '입력된 작업 설명을 보존합니다.', days: '당일',
    blogUrl: 'https://blog.naver.com/ace_dent_shop/fixture', gallery: [], ogImage: asset('og-image'),
    parts: [{ part: ['도어'], position: 'front', detail: '조수석 붓터치 부위', category: 'touch-up', note: '붓터치층 정리와 재터치업',
      before: asset('before'), after: asset('after'), thumbnail: asset('thumbnail'), gallery: [], comparisons: [] }],
  };
  const env = { ACEDENT_DB: binding, R2_PUBLIC_BASE_URL: 'https://images.example.test', ACEDENT_IMAGES: {
    async head(key) { return objects.get(key) ?? null; },
    async put() { throw new Error('Photo writes forbidden'); }, async delete() { throw new Error('Photo deletion forbidden'); },
  } };
  return { db, env, input };
}

test('new/edit persistence accepts touch-up in representative, PART and secondary fields; invalid categories rejected', async t => {
  const { db, env, input } = fixture(t);
  const prepared = await create.prepareNewWork(env, structuredClone(input));
  await env.ACEDENT_DB.batch(create.newWorkStatements(env, prepared, 'fixture@example.test'));
  assert.equal(prepared.work.slug, 'genesis-g80-front-right-door-touch-up');
  assert.equal(prepared.work.parts[0].category, 'touch-up');
  const { work } = await (await edit.getWorkForEdit(env, prepared.work.slug)).json();
  assert.equal(work.category, 'touch-up');
  const changed = { ...structuredClone(input), category: 'polish', subCategories: ['touch-up'] };
  const saved = await edit.updateWork(env, work.slug, changed);
  assert.equal(saved.status, 200, await saved.clone().text());
  const result = (await saved.json()).work;
  assert.equal(result.slug, work.slug);
  assert.deepEqual(result.parts, JSON.parse(JSON.stringify(prepared.work.parts)));
  for (const key of ['title', 'summary', 'body', 'date', 'days', 'blogUrl', 'ogImage', 'gallery']) assert.deepEqual(result[key], work[key]);
  assert.deepEqual(result.subCategories, ['touch-up']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asset_cleanup_queue').get().n, 0);
  const before = db.prepare('SELECT payload_json FROM works').get().payload_json;
  assert.equal((await edit.updateWork(env, work.slug, { ...changed, category: 'not-a-category' })).status, 400);
  assert.equal(db.prepare('SELECT payload_json FROM works').get().payload_json, before);
  await assert.rejects(() => create.prepareNewWork(env, { ...structuredClone(input), parts: [{ ...input.parts[0], category: 'not-a-category' }] }));
});

test('empty category hides, one case activates top-level only; mixed PARTs keep matching photos and parts', async t => {
  const { env, input } = fixture(t);
  const { work } = await create.prepareNewWork(env, structuredClone(input));
  assert(!categories.getAvailableWorkCategories([]).some(c => c.id === 'touch-up'));
  assert(categories.getAvailableWorkCategories([work]).some(c => c.id === 'touch-up'));
  assert.equal(landings.getWorkPartLandings([work]).length, 0);
  const mixed = { ...work, category: 'polish', subCategories: ['coating'], parts: [
    { ...work.parts[0], category: 'polish', part: ['범퍼'] },
    { ...work.parts[0], before: '/touch-up-before.jpg' },
  ] };
  assert.deepEqual(categories.getWorkFilterCategories(mixed), ['polish', 'touch-up', 'coating']);
  assert.deepEqual(categories.getWorkPartsForCategory(mixed, 'touch-up'), ['도어']);
  assert.deepEqual(categories.getWorkPartsForCategory(mixed, 'polish'), ['범퍼']);
  assert.equal(categories.getWorkRepresentativePart(mixed, 'touch-up').before, '/touch-up-before.jpg');
  assert.equal([mixed].filter(w => categories.workMatchesCategory(w, 'touch-up')).length, 1);
  const old = { ...mixed, parts: [{ ...mixed.parts[0], category: undefined }] };
  assert.deepEqual(categories.getExplicitPartCategories(old), []);
  assert.doesNotMatch(images.getWorkImageAlt(old, old.parts[0], '전'), /흠집·오염제거|터치업 보수/);
  assert.equal(types.getWorkCategoryLabel('polish'), '흠집·오염제거');
});

test('canonical, query/UTM, titles, ALT and dictionary use explicit touch-up without changing existing URLs', async t => {
  const { env, input } = fixture(t);
  const { work } = await create.prepareNewWork(env, structuredClone(input));
  work.slug = 'genesis-g80-front-right-door-polish';
  assert.equal(metadata.getWorkMetadata(work).canonical, `https://www.acedentshop.co.kr/works/detail/${work.slug}`);
  assert.equal(metadata.getWorksMetadata('touch-up', undefined, [work]).canonical, 'https://www.acedentshop.co.kr/works/touch-up');
  const url = new URL(routes.getLegacyWorksRedirect('/works', '?category=터치업 보수&part=도어&utm_source=fixture'), 'https://local.test');
  assert.equal(url.pathname, '/works/touch-up'); assert.equal(url.searchParams.get('part'), '도어');
  assert.equal(url.searchParams.get('utm_source'), 'fixture');
  assert.deepEqual(routes.readWorkFilters(url.pathname, url.search), { category: 'touch-up', part: '도어' });
  assert.equal(routes.getWorksCanonicalPath('touch-up'), '/works/touch-up');
  const copy = seo.getWorkSeoCopy(work);
  assert(copy.title.includes(work.title)); assert(!copy.title.includes('흠집·오염제거'));
  assert.match(images.getWorkImageAlt(work, work.parts[0], '전'), /터치업 보수/);
  const terms = loadTs('lib/slug-dictionary.ts').SLUG_WORK_TERMS;
  assert.equal(terms.터치업보수, 'touch-up'); assert.equal(terms.폴리싱, 'polish'); assert.notEqual(terms.샌딩, 'touch-up');
});

test('build synchronizer accepts touch-up PART and secondary categories without running env loading or network', async t => {
  const { env, input } = fixture(t);
  const { work } = await create.prepareNewWork(env, { ...structuredClone(input), subCategories: ['polish'] });
  const source = readFileSync(new URL('./sync-works.mjs', import.meta.url), 'utf8');
  const set = source.match(/const workCategories = new Set\(\[[\s\S]*?\]\);/)[0];
  // Trusted repository declarations only; never execute the script's entry point.
  const validateBody = source.slice(source.indexOf('function validateWork('), source.indexOf('function localRecords('));
  const validate = new Function(`${set} const galleryMaxPerScope=6, galleryMaxTotal=12, comparisonMaxPerPart=3, comparisonMaxTotal=6; const workPartPositions=new Set(['front','rear']); ${validateBody}; return validateWork;`)();
  assert.equal(validate(structuredClone(work), 'fixture').parts[0].category, 'touch-up');
  assert.deepEqual(validate({ ...structuredClone(work), category: 'polish', subCategories: ['touch-up'] }, 'fixture').subCategories, ['touch-up']);
  assert.throws(() => validate({ ...work, subCategories: ['not-a-category'] }, 'fixture'));
});
