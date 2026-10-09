import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const WorkDescription = loadTs('components/WorkDescription.tsx').default;
const { getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
const works = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8'))
  .records.map(({ work }) => work);

test('shared description keeps summary, separate body paragraphs and trailing blog link in order', () => {
  const html = renderToStaticMarkup(createElement(WorkDescription, {
    summary: '요약 원문', body: '첫 번째 문단\n\n두 번째 문단',
  }, createElement('a', { href: 'https://blog.naver.com/ace_dent_shop' }, '작업 과정')));
  assert.match(html, /<h2 class="work-detail-copy-title">작업 설명<\/h2>/);
  assert.match(html, /<p class="work-detail-summary">요약 원문<\/p><p>첫 번째 문단<\/p><p>두 번째 문단<\/p><a /);
  assert.equal((html.match(/<h1/g) ?? []).length, 0);
});

test('description preserves repeated paragraphs and escapes input instead of treating it as markup', () => {
  const html = renderToStaticMarkup(createElement(WorkDescription, {
    summary: '<img src=x>', body: '같은 문장\n\n같은 문장',
  }));
  assert(html.includes('&lt;img src=x&gt;'));
  assert.equal((html.match(/<p>같은 문장<\/p>/g) ?? []).length, 2);
});

test('static details include the description heading without reordering PART notes/photos or changing data', () => {
  const snapshot = JSON.stringify(works);
  const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  for (const work of works) {
    const html = getWorkDetailStaticHtml(work, [], 0, works);
    assert.equal((html.match(/<h2>작업 설명<\/h2>/g) ?? []).length, 1, work.slug);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1, work.slug);
    const descriptionAt = html.indexOf('<h2>작업 설명</h2>');
    assert(descriptionAt > html.lastIndexOf('<p>PART '), work.slug);
    assert(html.indexOf(`<p><strong>${escape(work.summary)}</strong></p>`) > descriptionAt, work.slug);
    for (const part of work.parts) {
      const noteAt = html.indexOf(`<p>${escape(part.note)}</p>`);
      const beforeAt = html.indexOf(`src="${escape(part.before)}"`, noteAt);
      assert(noteAt >= 0 && beforeAt > noteAt && beforeAt < descriptionAt, work.slug);
    }
    for (const paragraph of work.body.split('\n\n')) {
      assert(html.includes(`<p>${escape(paragraph)}</p>`), work.slug);
    }
  }
  assert.equal(JSON.stringify(works), snapshot);
});
