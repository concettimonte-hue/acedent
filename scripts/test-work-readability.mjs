import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const WorkDescription = loadTs('components/WorkDescription.tsx').default;
const SiteFooter = loadTs('components/SiteFooter.tsx').default;
const { getHomeStaticHtml, getWorksStaticHtml, getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
const { WORK_CATEGORIES } = loadTs('content/works/types.ts');
const { getWorkPartLandings } = loadTs('lib/work-landings.ts');
const site = JSON.parse(readFileSync(new URL('../content/site.json', import.meta.url), 'utf8'));
const business = JSON.parse(readFileSync(new URL('../content/business.json', import.meta.url), 'utf8'));
const works = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8'))
  .records.map(({ work }) => work);
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

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

test('static home includes the existing service and principle descriptions in their React section order', () => {
  const html = getHomeStaticHtml(works);
  const reactSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  for (const [id, field] of [['services', 'services'], ['principle', 'principles']]) {
    assert(reactSource.includes(`<p>{${field}.description}</p>`));
    const section = html.match(new RegExp(`<section id="${id}">([\\s\\S]*?)</section>`))?.[1];
    assert(section, id);
    const paragraph = `<p>${escape(site[field].description)}</p>`;
    assert.equal(html.split(paragraph).length - 1, 1, id);
    assert(section.indexOf(paragraph) > section.indexOf('</h2>'), id);
    assert(section.indexOf(paragraph) < section.indexOf('<article>'), id);
  }
});

test('every static public template keeps exactly one footer with the same text and links as React', () => {
  const snapshot = JSON.stringify(works);
  const renderedFooter = renderToStaticMarkup(createElement(SiteFooter))
    .match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
  assert(renderedFooter);
  const textNodes = (html) => html.split(/<[^>]*>/).map((node) => node.trim()).filter(Boolean);
  const linkDestinations = (html) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((match) => match[1]);
  const address = [business.address.addressRegion, business.address.addressLocality, business.address.streetAddress].join(' ');
  assert(renderedFooter.includes(`<address>${escape(address)}</address>`));
  const pages = [
    ['home', getHomeStaticHtml(works)],
    ['gallery', getWorksStaticHtml(works)],
    ['empty gallery', getWorksStaticHtml([])],
    ...WORK_CATEGORIES.map(({ id }) => [id, getWorksStaticHtml(works, id)]),
    ...getWorkPartLandings(works).map(({ path, category, part }) => [path, getWorksStaticHtml(works, category, part)]),
    ...works.map((work) => [work.slug, getWorkDetailStaticHtml(work, [], 0, works)]),
  ];
  for (const [path, html] of pages) {
    const footers = [...html.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/g)];
    assert.equal(footers.length, 1, path);
    const footer = footers[0][0];
    assert.deepEqual(textNodes(footer), textNodes(renderedFooter), path);
    assert.deepEqual(linkDestinations(footer), linkDestinations(renderedFooter), path);
    assert(footer.includes(`<address>${escape(address)}</address>`), path);
    assert.equal((footer.match(/<address>/g) ?? []).length, 1, path);
    assert(html.trimEnd().endsWith(`${footer}\n  </main>`), path);
  }
  assert.equal(JSON.stringify(works), snapshot);
});
