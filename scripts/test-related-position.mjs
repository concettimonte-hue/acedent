// Synthetic fixtures only: no operating case edits, network or credentials.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const { selectRelatedWorkSuggestions: recommend, getRelatedWorkReasonLabels: labels } = loadTs('lib/work-related.ts');
const { getWorkCardImageSrcForCategory: cardImage } = loadTs('lib/work-images.ts');
const part = (bodyPart, category = 'panel-paint', position) => ({
  part: [bodyPart], category, position, label: '', note: '',
  before: `/${bodyPart}-${position ?? 'unknown'}-before.jpg`, after: '/after.jpg',
});
const work = (slug, parts, extra = {}) => ({
  slug, date: '2026-10-27', title: '로컬 검증', category: 'panel-paint',
  subCategories: [], part: parts[0].part, subParts: [], carMaker: '현대', carModel: '쏘나타',
  parts, summary: '입력한 작업 설명', body: '', days: '1일', sliderType: 'handle', featured: false,
  ...extra,
});

test('same part/work ranks explicit same position, unknown, then opposite in both directions', () => {
  for (const bodyPart of ['범퍼', '도어', '휀더']) for (const position of ['front', 'rear']) {
    const source = work('source', [part(bodyPart, 'panel-paint', position)]);
    const opposite = work('opposite', [part(bodyPart, 'panel-paint', position === 'front' ? 'rear' : 'front')]);
    const unknown = work('unknown', [part(bodyPart)]);
    const same = work('same', [part(bodyPart, 'panel-paint', position)]);
    const picks = recommend([source, opposite, unknown, same], source);
    assert.deepEqual(picks.map(p => p.work.slug), ['same', 'unknown', 'opposite']);
    assert.equal(picks[0].matchedPosition, position);
    assert.deepEqual(labels(picks[0]), [`같은 ${position === 'front' ? '앞' : '뒤'}${bodyPart}`, '같은 작업']);
    for (const pick of picks.slice(1)) assert.deepEqual(labels(pick), ['같은 부위', '같은 작업']);
    assert.equal(recommend([same, unknown, opposite], source, 2).length, 2);
  }
});

test('position and image come from the matching PART, never another PART/category', () => {
  const source = work('source', [part('범퍼', 'panel-paint', 'rear')]);
  const crossed = work('crossed', [part('범퍼', 'panel-paint', 'front'), part('범퍼', 'polish', 'rear')]);
  const unknown = work('unknown', [part('범퍼')]);
  const exact = work('exact', [part('범퍼', 'panel-paint', 'front'), part('범퍼', 'panel-paint', 'rear')]);
  const picks = recommend([crossed, unknown, exact], source);
  assert.deepEqual(picks.map(p => p.work.slug), ['exact', 'unknown', 'crossed']);
  assert.equal(picks[0].matchedPartIndex, 1);
  assert.equal(picks[2].matchedPartIndex, 0);
  assert.equal(picks[2].matchedPosition, undefined);
  assert.equal(cardImage(exact, picks[0].matchedCategory, picks[0].matchedPart, 'before', picks[0].matchedPartIndex), '/범퍼-rear-before.jpg');
});

test('part-only ties use position across actual parts, without inferring missing mixed-work categories', () => {
  const source = work('source', [part('범퍼', 'panel-paint', 'front'), part('도어', 'dent', 'rear')]);
  const opposite = work('opposite', [part('범퍼', 'polish', 'rear'), part('도어', 'polish', 'rear')]);
  const unknown = work('unknown', [part('범퍼', 'polish')]);
  const same = work('same', [part('범퍼', 'polish', 'front')]);
  const picks = recommend([opposite, unknown, same], source);
  assert.deepEqual(picks.map(p => p.work.slug), ['same', 'unknown', 'opposite']);
  assert.deepEqual(labels(picks[0]), ['같은 앞범퍼']);
  assert.equal(picks[2].matchedPartIndex, 0); // Primary body part stays ahead of a secondary one.
  const missing = work('missing', [{ ...part('범퍼', 'panel-paint', 'front'), category: undefined }, part('도어', 'polish')]);
  assert.deepEqual(recommend([missing], source)[0].reasons, ['part']);
});

test('unknown source preserves order; text and positions on unrelated parts never create a match', () => {
  const source = work('source', [{ ...part('범퍼'), label: '앞범퍼' }], { title: '앞범퍼 수리' });
  const front = work('front', [part('범퍼', 'panel-paint', 'front')]);
  const rear = work('rear', [part('범퍼', 'panel-paint', 'rear')]);
  assert.deepEqual(recommend([rear, front], source).map(p => p.work.slug), ['rear', 'front']);
  assert.equal(recommend([front], source)[0].matchedPosition, undefined);
  const roof = work('roof', [part('루프', 'panel-paint', 'front')]);
  const first = work('first', [part('루프', 'panel-paint', 'rear')]);
  const second = work('second', [part('루프', 'panel-paint', 'front')]);
  assert.deepEqual(recommend([first, second], roof).map(p => p.work.slug), ['first', 'second']);
  assert.equal(recommend([second], roof)[0].matchedPosition, undefined);
});

test('single legacy PART still matches; additional comparisons and subParts never affect recommendations', () => {
  const source = work('source', [part('도어', 'dent', 'rear')], { category: 'dent' });
  const legacy = work('legacy', [{ ...part('도어'), part: undefined, category: undefined }], { part: ['도어'], category: 'dent' });
  assert.deepEqual(recommend([legacy], source)[0].reasons, ['part', 'category']);
  const baseline = recommend([legacy], source);
  const added = structuredClone(source);
  added.subParts = ['범퍼'];
  added.parts[0].comparisons = [{ before: '/extra.jpg', after: '/extra-after.jpg', caption: '앞범퍼' }];
  assert.deepEqual(recommend([legacy], added), baseline);
  const onlyTag = work('only-tag', [part('범퍼', 'polish')], { category: 'polish', subParts: ['도어'] });
  assert.deepEqual(recommend([onlyTag], source), []);
});

test('React card and static fallback show the same reason, matching Before photo and existing URL', () => {
  const source = work('source', [part('도어', 'panel-paint', 'rear')]);
  const candidate = work('existing-url', [part('도어', 'panel-paint', 'front'), part('도어', 'panel-paint', 'rear')]);
  const snapshot = JSON.stringify([source, candidate]);
  const [pick] = recommend([candidate], source);
  const react = renderToStaticMarkup(createElement(loadTs('components/WorkCard.tsx').default, {
    work: candidate, contextCategory: pick.matchedCategory, contextPart: pick.matchedPart,
    matchedPartIndex: pick.matchedPartIndex, reasonLabels: labels(pick), imageState: 'before',
  }));
  const html = loadTs('lib/static-html.ts').getWorkDetailStaticHtml(source, [pick], 2, [source, candidate]);
  const relatedHtml = html.slice(html.indexOf('RELATED WORKS'));
  for (const rendered of [react, relatedHtml]) {
    assert.match(rendered, /같은 뒤도어 · 같은 작업/);
    assert.match(rendered, /src="\/도어-rear-before.jpg"/);
    assert.doesNotMatch(rendered, /src="\/도어-front-before.jpg"/);
    assert.match(rendered, /href="\/works\/detail\/existing-url"/);
  }
  assert.equal(JSON.stringify([source, candidate]), snapshot);
});
