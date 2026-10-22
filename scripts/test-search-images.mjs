// Offline SEO regression checks. No credentials, operational writes or network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { loadTs } from './test-support.mjs';

const root = resolve(import.meta.dirname, '..');
const { getWorksMetadata, getWorkMetadata, applyClientMetadata } = loadTs('lib/work-metadata.ts');
const { homeImage, homeMetadata, getPageImageJsonLd, pageImageJsonLdId, siteUrl, organizationJsonLd, autoBodyShopJsonLd, worksOgImageUrl } = loadTs('lib/seo.ts');
const { getAvailableWorkCategories } = loadTs('lib/work-categories.ts');
const { getWorkPartLandings } = loadTs('lib/work-landings.ts');
const works = loadTs('lib/works.ts').getWorks();
const base = works[0];
const media = (category, part, key) => ({ category, part: [part], label: part, note: '', before: `/works/${key}-before.jpg`, after: `/works/${key}-after.jpg` });
const fixture = (slug, parts, extra = {}) => ({ ...base, slug, date: '2026-01-01', category: 'panel-paint', subCategories: [], parts, ...extra });

await test('home photo and logo have separate roles; preferred URL is absolute', () => {
  assert.equal(homeImage.image, siteUrl + '/storefront.jpg');
  assert.equal(autoBodyShopJsonLd.image, homeImage.image);
  assert.equal(organizationJsonLd.logo.contentUrl, siteUrl + '/images/ace-dent-logo.png');
  assert.equal(autoBodyShopJsonLd.logo, organizationJsonLd.logo.contentUrl);
  const page = getPageImageJsonLd(homeMetadata);
  assert.equal(page['@type'], 'WebPage');
  assert.equal(page.primaryImageOfPage, homeImage.image);
  assert.equal(page.url, siteUrl);
  assert.equal(page['@id'], siteUrl + '#webpage');
});

await test('mixed case selects the exact category/part, never the case OG or another PART', () => {
  const mixed = fixture('mixed', [media('panel-paint', '도어', 'door'), media('partial-paint', '범퍼', 'bumper')], { ogImage: '/works/mixed-og.jpg', subCategories: ['polish'] });
  const before = JSON.stringify(mixed);
  const partial = getWorksMetadata('partial-paint', '범퍼', [mixed]);
  assert.equal(partial.image, siteUrl + '/works/bumper-before.jpg');
  assert.match(partial.imageAlt, /범퍼 부분도색 수리 전/);
  assert.equal(partial.canonical, siteUrl + '/works/partial-paint/bumper');
  assert.equal(getWorksMetadata('partial-paint', '도어', [mixed]).image, homeImage.image);
  assert.equal(getWorksMetadata('polish', undefined, [mixed]).image, homeImage.image, 'extra category alone never assigns a job to a PART');
  assert.equal(JSON.stringify(mixed), before);
});

await test('explicit PART wins over newer legacy content; legacy ALT does not invent a method', () => {
  const legacy = fixture('legacy', [media(undefined, '도어', 'legacy')], { category: 'dent', date: '2026-10-01' });
  const explicit = fixture('explicit', [media('dent', '도어', 'explicit')], { category: 'dent' });
  assert.equal(getWorksMetadata('dent', undefined, [legacy, explicit]).image, siteUrl + '/works/explicit-before.jpg');
  const old = getWorksMetadata('dent', '도어', [legacy]);
  assert.equal(old.image, siteUrl + '/works/legacy-before.jpg');
  assert(!old.imageAlt.includes('덴트'));
  assert(old.imageAlt.endsWith('도어 수리 전'));
});

await test('same-day ordering is deterministic and inputs remain unchanged', () => {
  const a = fixture('a', [media('dent', '도어', 'a')]);
  const b = fixture('b', [media('dent', '도어', 'b')]);
  const input = [b, a];
  const before = JSON.stringify(input);
  assert.deepEqual(getWorksMetadata('dent', undefined, input), getWorksMetadata('dent', undefined, [a, b]));
  assert.equal(JSON.stringify(input), before);
});

await test('all-works and detail preserve OG/After rules; missing category uses a neutral photo', () => {
  assert.equal(getWorksMetadata(undefined, undefined, works).image, worksOgImageUrl);
  const work = fixture('detail', [media('panel-paint', '도어', 'detail')], { ogImage: '/works/detail-og.jpg' });
  const composite = getWorkMetadata(work);
  assert.equal(composite.image, siteUrl + work.ogImage);
  assert.deepEqual([composite.imageWidth, composite.imageHeight], [1200, 630]);
  delete work.ogImage;
  const after = getWorkMetadata(work);
  assert.equal(after.image, siteUrl + work.parts[0].after);
  assert.deepEqual([after.imageWidth, after.imageHeight], [1600, 1200]);
  assert(after.imageAlt.endsWith('수리 후'));
  assert.equal(getWorksMetadata('coating', undefined, []).image, homeImage.image);
});

function mockDocument() {
  const nodes = new Map();
  const node = () => ({ attrs: {}, textContent: '', setAttribute(k, v) { this.attrs[k] = v; } });
  return { nodes, head: {
    querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); },
    appendChild(element) { nodes.set(element.id, element); },
  }, getElementById(id) { return nodes.get(id); }, createElement() { return node(); } };
}

await test('client route transitions refresh dimensions/type/ALT and one WebPage, not stale metadata', () => {
  const previous = globalThis.document;
  const doc = mockDocument();
  globalThis.document = doc;
  try {
    for (const metadata of [getWorkMetadata(base), getWorksMetadata('dent', '도어', works), getWorksMetadata(undefined, undefined, works), homeMetadata]) {
      applyClientMetadata(metadata);
      applyClientMetadata(metadata);
      assert.equal(doc.title, metadata.title);
      for (const [key, expected] of Object.entries({ 'og:image': metadata.image, 'og:image:alt': metadata.imageAlt, 'og:image:width': String(metadata.imageWidth), 'og:image:height': String(metadata.imageHeight), 'og:type': metadata.type ?? 'website' })) {
        assert.equal(doc.nodes.get(`meta[property="${key}"]`).attrs.content, expected);
      }
      assert.equal(doc.nodes.get('link[rel="canonical"]').attrs.href, metadata.canonical);
      assert.deepEqual(JSON.parse(doc.getElementById(pageImageJsonLdId).textContent), getPageImageJsonLd(metadata));
      assert.equal([...doc.nodes.keys()].filter(key => key === pageImageJsonLdId).length, 1);
    }
  } finally { globalThis.document = previous; }
});

const unescape = value => value.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
function assertHead(html, metadata, label) {
  const readMeta = (attribute, key) => unescape(html.match(new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="([^"]*)"`))?.[1] ?? '');
  assert.equal(unescape(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ''), metadata.title, label);
  assert.equal(readMeta('name', 'description'), metadata.description, label);
  for (const [key, expected] of Object.entries({ 'og:image': metadata.image, 'og:image:alt': metadata.imageAlt, 'og:image:width': String(metadata.imageWidth), 'og:image:height': String(metadata.imageHeight) })) assert.equal(readMeta('property', key), expected, `${label}: ${key}`);
  assert.equal(readMeta('name', 'twitter:image'), metadata.image, label);
  assert(html.includes(`rel="canonical" href="${metadata.canonical}"`), label);
}

await test('source home fallback stays aligned with common home metadata', () => {
  assertHead(readFileSync(resolve(root, 'index.html'), 'utf8'), homeMetadata, 'home fallback');
});

const distFlag = process.argv.indexOf('--dist');
if (distFlag !== -1) {
  const dist = resolve(root, process.argv[distFlag + 1]);
  await test('every generated route shares metadata with the client; private page has no WebPage', () => {
    const pages = [
      ['index.html', homeMetadata], ['works.html', getWorksMetadata(undefined, undefined, works)],
      ...getAvailableWorkCategories(works).map(c => [`works/${c.id}.html`, getWorksMetadata(c.id, undefined, works)]),
      ...getWorkPartLandings(works).map(l => [l.path.slice(1) + '.html', getWorksMetadata(l.category, l.part, works)]),
      ...works.map(w => [`works/detail/${w.slug}.html`, getWorkMetadata(w)]),
    ];
    for (const [file, metadata] of pages) {
      const html = readFileSync(resolve(dist, file), 'utf8');
      assertHead(html, metadata, file);
      const matches = [...html.matchAll(new RegExp(`<script[^>]*id="${pageImageJsonLdId}"[^>]*>([\\s\\S]*?)<\\/script>`, 'g'))];
      assert.equal(matches.length, 1, file);
      assert.deepEqual(JSON.parse(matches[0][1]), getPageImageJsonLd(metadata), file);
      assert(html.includes('index, follow, max-image-preview:large'), file);
    }
    const admin = readFileSync(resolve(dist, 'admin.html'), 'utf8');
    assert(admin.includes('noindex, nofollow'));
    assert(!admin.includes(pageImageJsonLdId));
    console.log(`Static/client metadata identical: ${pages.length} routes / ${works.length} cases`);
  });
}
