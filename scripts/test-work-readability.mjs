import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const WorkDescription = loadTs('components/WorkDescription.tsx').default;
const SiteFooter = loadTs('components/SiteFooter.tsx').default;
const WorksGalleryPage = loadTs('components/WorksGalleryPage.tsx').default;
const { getHomeStaticHtml, getWorksStaticHtml, getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
const { WORK_CATEGORIES, WORK_PART_FILTER_ORDER } = loadTs('content/works/types.ts');
const { getWorkCategoryGuide } = loadTs('lib/work-seo.ts');
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

function renderGallery(category, part) {
  const previousWindow = globalThis.window;
  globalThis.window = { location: {
    pathname: category ? `/works/${category}` : '/works',
    search: part ? `?part=${encodeURIComponent(part)}` : '',
  } };
  try {
    return renderToStaticMarkup(createElement(WorksGalleryPage, { category, part }));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('category guides are closed native disclosures with identical initial React/static content', () => {
  const snapshot = JSON.stringify(works);
  for (const category of [undefined, ...WORK_CATEGORIES.map(({ id }) => id)]) {
    for (const part of [undefined, ...WORK_PART_FILTER_ORDER]) {
      const guide = getWorkCategoryGuide(category, part);
      const expected = category === 'partial-paint' || category === 'full-polish' ||
        (category === 'panel-paint' && !part);
      assert.equal(Boolean(guide), expected, `${category}/${part}`);
      const extract = (html) => [...html.matchAll(/<details class="works-category-guide"[^>]*>[\s\S]*?<\/details>/g)]
        .map(([details]) => details);
      const staticDetails = extract(getWorksStaticHtml(works, category, part));
      const reactDetails = extract(renderGallery(category, part));
      assert.equal(staticDetails.length, expected ? 1 : 0, `${category}/${part}`);
      assert.deepEqual(reactDetails, staticDetails, `${category}/${part}`);
      if (!guide) continue;
      const [html] = staticDetails;
      assert.doesNotMatch(html, /^<details[^>]*\bopen\b/);
      assert.match(html, /<summary><h2 id="works-category-guide-/);
      assert.match(html, /class="when-closed">설명 보기<\/span>/);
      assert.match(html, /class="when-open">접기<\/span>/);
      assert.doesNotMatch(html, /<(button|a)\b/);
      assert.equal((html.match(/<h2\b/g) ?? []).length, 1);
      assert.equal((html.match(/<p>/g) ?? []).length, guide.paragraphs.length);
      for (const paragraph of guide.paragraphs) {
        assert.equal(html.split(`<p>${escape(paragraph)}</p>`).length - 1, 1);
      }
    }
  }
  assert.equal(JSON.stringify(works), snapshot);
});

test('existing guide copy is preserved and only the reviewed panel-paint copy is added', () => {
  assert.deepEqual(getWorkCategoryGuide('partial-paint').paragraphs, [
    '부분도색은 손상 범위가 국소적인 경우 패널 전체를 넓게 작업하지 않고 손상된 범위를 중심으로 진행하는 방식입니다. 사례 카드에서 작업 전 손상 위치와 작업 후 마감 상태를 차종과 부위별로 비교할 수 있습니다.',
    '적용 가능 여부는 손상 범위와 위치, 기존 도장 상태에 따라 달라집니다. 손상 부위가 잘 보이는 사진을 보내주시면 부분도색으로 가능한지 먼저 확인해 안내합니다.',
  ]);
  const polish = JSON.parse(readFileSync(new URL('../content/polish.json', import.meta.url), 'utf8'));
  const fullPolishService = polish.items.find((item) => item.id === 'fullpolish');
  assert.deepEqual(getWorkCategoryGuide('full-polish').paragraphs, [
    [fullPolishService.desc, fullPolishService.notWhen].filter(Boolean).join(' '),
    `사례의 작업 전후 사진에서 도장면의 선명도와 광도 변화를 확인하세요. ${polish.closing}`,
  ]);
  assert.equal(getWorkCategoryGuide('panel-paint').title, '판금도색과 교환은 어떻게 판단하나요?');
  assert.deepEqual(getWorkCategoryGuide('panel-paint').paragraphs, [
    '판금도색은 찌그러진 철판을 펴고 그 부분만 색을 다시 칠하는 작업입니다. 비용은 손상 정도와 패널 수에 따라 달라지고 정확한 기간은 차량 상태 확인 후 안내하며, 사진만으로 단정하기 어려운 부분은 방문 확인을 안내합니다.',
    '복원보다 부품 교환이 비용이 적으면 교환을 권하고, 서비스센터가 더 저렴한 경우도 숨기지 않습니다. 색상이 완전히 같을 수 없는 경우나 심한 찌그러짐으로 처음의 예리한 각을 그대로 만들기 어려운 경우처럼, 가능한 결과와 작업의 한계는 작업 전에 설명합니다.',
  ]);
});
