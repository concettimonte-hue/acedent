// Local metadata/HTML checks only; no environment files, credentials or remote writes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const root = resolve(import.meta.dirname, '..');
const { siteUrl, organizationJsonLd } = loadTs('lib/seo.ts');
const { getImageRightsMetadata, imageUsagePath } = loadTs('lib/image-rights.ts');
const { getWorkImageJsonLd } = loadTs('lib/work-metadata.ts');
const { getHomeStaticHtml, getWorksStaticHtml, getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
const records = JSON.parse(readFileSync(resolve(root, 'content/works.generated.json'), 'utf8')).records;
const works = records.map(record => record.work);
const policy = readFileSync(resolve(root, 'public/photo-usage/index.html'), 'utf8');
const expected = getImageRightsMetadata(siteUrl);

function assertRights(image) {
  assert.equal(image['@type'], 'ImageObject');
  assert.match(image.contentUrl, /^https:\/\//);
  for (const [key, value] of Object.entries(expected)) assert.deepEqual(image[key], value);
}

await test('absolute usage and permission URLs; existing attribution preserved', () => {
  assert.equal(expected.license, siteUrl + '/photo-usage/');
  assert.equal(expected.acquireLicensePage, expected.license + '#permission-request');
  assert.equal(getImageRightsMetadata(siteUrl + '///').license, expected.license);
  assert.equal(getImageRightsMetadata(siteUrl + '/').acquireLicensePage, expected.acquireLicensePage);
  assert.deepEqual(expected.creator, { '@type': 'Organization', name: '에이스덴트', url: siteUrl });
  assert.equal(expected.creditText, '에이스덴트');
  assert.equal(expected.copyrightNotice, '© 에이스덴트. 무단 복제·사용 금지.');
  assert.equal(organizationJsonLd.logo.license, undefined, 'photo policy is not assigned to unrelated logos');
});

await test('all image kinds share rights without mutating work data', () => {
  const image = src => ({ src, thumbnail: src, caption: '추가 사진', width: 1600, height: 1200 });
  const work = structuredClone(works[0]);
  work.ogImage = '/works/rights-test-og.jpg';
  work.parts = [{ ...work.parts[0],
    before: '/works/rights-test-before.jpg', after: '/works/rights-test-after.jpg',
    gallery: [image('/works/rights-test-part-gallery.jpg')],
    comparisons: [{ before: '/works/rights-test-comparison-before.jpg', after: '/works/rights-test-comparison-after.jpg', caption: '다른 각도' }],
  }];
  work.gallery = [image('/works/rights-test-gallery.jpg')];
  const before = structuredClone(work);
  const images = getWorkImageJsonLd(work)['@graph'];
  assert.equal(images.length, 7);
  images.forEach(assertRights);
  assert.equal(images.filter(item => item.representativeOfPage).length, 1);
  assert.deepEqual(work, before);
});

await test('all existing local cases gain metadata without resaving or changing content', () => {
  const before = JSON.stringify(works);
  assert(works.length > 0);
  for (const work of works) {
    const images = getWorkImageJsonLd(work)['@graph'];
    assert(images.length >= 2, work.slug);
    images.forEach(assertRights);
  }
  assert.equal(JSON.stringify(works), before);
});

await test('static and React footers expose the same policy link and keep logo credits separate', () => {
  const Footer = loadTs('components/SiteFooter.tsx').default;
  const htmls = [
    renderToStaticMarkup(createElement(Footer)),
    getHomeStaticHtml(works),
    getWorksStaticHtml(works),
    getWorkDetailStaticHtml(works[0], [], works.length, works),
  ];
  for (const html of htmls) {
    assert(html.includes('href="' + imageUsagePath + '">사진 이용 안내</a>'));
    assert(html.includes('href="/brands/credits.html">로고 출처</a>'));
  }
});

await test('public policy has matching anchors, real contact, crawlability and no free-use grant', () => {
  assert(policy.includes('rel="canonical" href="' + expected.license + '"'));
  assert(policy.includes('id="' + new URL(expected.acquireLicensePage).hash.slice(1) + '"'));
  const site = JSON.parse(readFileSync(resolve(root, 'content/site.json'), 'utf8'));
  assert(policy.includes('href="' + site.contact.phoneHref + '"'));
  assert(policy.includes('content="index, follow"'));
  assert(policy.includes('사전 허가'));
  assert(policy.includes('무료 사용이나 자동 사용 허가를 뜻하지 않습니다'));
  assert(!policy.includes('creativecommons.org'));
  assert(!policy.includes('<script'), 'policy remains standalone static HTML');
});

const distArg = process.argv.indexOf('--dist');
if (distArg !== -1) {
  assert(process.argv[distArg + 1], '--dist requires a directory');
  const dist = resolve(root, process.argv[distArg + 1]);
  await test('actual Vite detail output matches shared metadata for every local case', () => {
    const details = resolve(dist, 'works/detail');
    assert.equal(readdirSync(details).filter(file => file.endsWith('.html')).length, works.length);
    let count = 0;
    for (const work of works) {
      const html = readFileSync(resolve(details, work.slug + '.html'), 'utf8');
      const match = html.match(/<script id="work-image-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/);
      assert(match, work.slug);
      const rendered = JSON.parse(match[1])['@graph'];
      const shared = getWorkImageJsonLd(work)['@graph'];
      assert.equal(rendered.length, shared.length, work.slug);
      rendered.forEach((image, index) => {
        assertRights(image);
        assert.equal(image.contentUrl, shared[index].contentUrl);
        assert.equal(image.name, shared[index].name);
      });
      count += rendered.length;
      assert(html.includes('href="' + imageUsagePath + '">사진 이용 안내</a>'));
    }
    assert.equal(readFileSync(resolve(dist, 'photo-usage/index.html'), 'utf8'), policy);
    for (const file of ['index.html', 'works.html']) {
      assert(readFileSync(resolve(dist, file), 'utf8').includes('href="' + imageUsagePath + '">사진 이용 안내</a>'));
    }
    console.log('Verified static rights: ' + works.length + ' cases / ' + count + ' images');
  });
}
