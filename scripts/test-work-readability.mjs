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
      const expected = !part || category === 'partial-paint' || category === 'full-polish';
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

test('repair guides distinguish similar jobs by visible damage and expected finish', () => {
  const examples = [
    ['panel-paint', '찌그러지고', '펴야 할 곳과 칠해야 할 곳의 넓이는 다를 수'],
    ['partial-paint', '범퍼 모서리', '주변 색과 자연스럽게 이어지도록'],
    ['touch-up', '돌에 맞아', '색 차이나 붓자국이 남을 수'],
    ['polish', '다른 차 페인트', '내 차의 칠까지 벗겨졌다면'],
    ['full-polish', '차 전체', '도장이 얇아진 곳은 무리해서 깎지 않으며'],
  ];
  for (const [category, symptom, distinction] of examples) {
    const { title, paragraphs } = getWorkCategoryGuide(category);
    assert.ok(title.includes(symptom), category);
    assert.ok(paragraphs.some((text) => text.includes(distinction)), category);
  }
});

test('dent guide keeps the reviewed title and two paragraphs', () => {
  assert.equal(getWorkCategoryGuide('dent').title, '문콕·찌그러짐은 덴트로 가능할까요?');
  assert.deepEqual(getWorkCategoryGuide('dent').paragraphs, [
    '덴트는 문콕처럼 도장이 벗겨지지 않은 눌림을 새로 칠하지 않고 펴는 작업입니다. 도장 상태와 손상 위치·깊이, 도구 접근 가능 여부를 확인해 복원 방법을 정합니다.',
    '접근 가능한 부위는 구멍을 뚫지 않는 무천공 방식으로 작업합니다. 다만 심한 찌그러짐이나 날카롭게 꺾인 부분은 흔적이 남을 수 있고, 도장이 손상된 경우에는 도색이 필요할 수 있습니다. 사진만으로 판단하기 어려운 부분은 방문 확인 후 가능한 결과와 작업 범위를 안내합니다.',
  ]);
});
