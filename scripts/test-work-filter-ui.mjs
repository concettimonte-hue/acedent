// Local-only gallery fixture. No connected browser, remote data writes or analytics.
// Optional --baseline records the pre-change layout; set PLAYWRIGHT_MODULE_PATH if needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { loadTs } from './test-support.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'outputs/site-009');
const baseline = process.argv.includes('--baseline');
const historyOnly = process.argv.includes('--history-only');
const noScreenshots = historyOnly || process.argv.includes('--no-screenshots');
const reportName = process.argv.find(arg => arg.startsWith('--report='))?.slice('--report='.length) || 'result';
assert(/^[a-z0-9-]+$/.test(reportName), 'report must be a local filename stem');
const { getWorks } = loadTs('lib/works.ts');
const { workMatchesCategory, getWorkPartsForCategory } = loadTs('lib/work-categories.ts');
const { getWorksStaticHtml } = loadTs('lib/static-html.ts');
const works = getWorks();
const matching = (category, part) => works.filter(work => (!category || workMatchesCategory(work, category)) && (!part || getWorkPartsForCategory(work, category).includes(part)));
const fixtureId = '/gallery-fixture.js';
const intro = '작업 방식이나 손상 부위로 비슷한 사례를 찾아보세요. 아는 항목만 골라도 됩니다.';

await test(`gallery filters: ${baseline ? 'baseline layout' : 'local behavior and layout'}`, async t => {
  mkdirSync(output, { recursive: true });
  const server = await createServer({
    root, configFile: false, envFile: false, resolve: { alias: { '@': root } },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [react(), {
      name: 'local-gallery-fixture',
      resolveId(id) { if (id === fixtureId) return `\0${fixtureId}`; },
      load(id) {
        if (id === `\0${fixtureId}`) return `import React from 'react';
          import { createRoot } from 'react-dom/client';
          import SiteRouter from '/components/SiteRouter.tsx';
          import '/app/globals.css';
          window.__events = []; window.gtag = (...args) => window.__events.push(args);
          createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null, React.createElement(SiteRouter)));`;
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (!/^\/works(?:\/[a-z-]+){0,2}(?:\?|$)/.test(request.url || '')) return next();
          response.setHeader('Content-Type', 'text/html');
          response.end(await vite.transformIndexHtml(request.url, `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="https://www.acedentshop.co.kr/works"></head><body><div id="root"></div><script type="module" src="${fixtureId}"></script></body></html>`));
        });
      },
    }],
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const errors = [], blocked = [], layouts = [], historyStates = [];
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    let sessionChecks = 0;
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') { blocked.push(request.method()); return route.abort(); }
      if (url.origin === origin && url.pathname === '/admin/api/session') {
        sessionChecks++;
        return route.fulfill({ json: { authenticated: true, expiresAt: Date.now() + 120000 }, headers: { 'Cache-Control': 'private, no-store' } });
      }
      if (url.origin === origin) return route.continue();
      if (request.resourceType() === 'image' && ['images.acedentshop.co.kr', 'pub-e6a8f147577c403f93d85e03a6361345.r2.dev'].includes(url.hostname)) {
        const local = resolve(root, 'public/works', basename(url.pathname));
        if (existsSync(local)) return route.fulfill({ contentType: 'image/jpeg', body: readFileSync(local) });
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#252a25"/><text x="400" y="300" text-anchor="middle" fill="#b9beb9" font-family="Arial" font-size="22">LOCAL PHOTO PLACEHOLDER</text></svg>' });
      }
      blocked.push(url.origin + url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    const categoryLink = label => page.locator('.work-category-tabs a').filter({ hasText: new RegExp(`^${label}$`) });
    const partLink = label => page.locator('.work-part-filter a').filter({ hasText: new RegExp(`^${label}$`) });
    const cardLinks = () => page.locator('.work-card').evaluateAll(els => els.map(el => el.getAttribute('href')));
    const events = () => page.evaluate(() => window.__events.filter(e => e[1] === 'filter_use'));
    const checkCards = async (category, part) => {
      const expected = matching(category, part).map(w => `/works/detail/${w.slug}`);
      await page.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('.work-card')].map(el => el.getAttribute('href'))) === JSON.stringify(expected), expected);
      assert.deepEqual(await cardLinks(), expected);
    };
    async function open(path) {
      await page.goto(`${origin}${path}`);
      await page.locator('.work-card').first().waitFor();
      await page.locator('.work-card-edit-link').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
    }
    async function layout(name, path, width = 390) {
      await page.setViewportSize({ width, height: width > 680 ? 1000 : 844 });
      await open(path);
      const geometry = await page.evaluate(() => ({
        firstPhotoY: document.querySelector('.work-card-media').getBoundingClientRect().top + scrollY,
        overflow: document.documentElement.scrollWidth > innerWidth,
        count: document.querySelectorAll('.work-card').length,
      }));
      assert.equal(geometry.overflow, false);
      layouts.push({ name, path, width, ...geometry });
      if (!noScreenshots) await page.screenshot({ path: resolve(output, `${baseline ? 'before' : 'after'}-${name}.png`) });
      if (!baseline) {
        assert.equal(await page.locator('.works-page-hero > span').textContent().then(v => v.trim()), intro);
        for (const question of ['어떤 작업이 궁금하세요?', '어디가 손상됐나요?']) assert(await page.getByText(question, { exact: true }).isVisible());
        for (const group of await page.locator('.work-filter-group').all()) {
          const overflow = await group.locator('.work-filter-rail-shell > nav, .work-filter-rail-shell > div').evaluate(el => el.scrollWidth - el.clientWidth > 3);
          assert.equal(await group.locator('.work-filter-swipe-hint').count(), overflow ? 1 : 0);
        }
      }
    }
    if (!historyOnly) await t.test('390px default, dent and selected layout; PC selected; 320px overflow', async () => {
      await layout('390-default', '/works');
      await layout('390-dent', '/works/dent');
      await layout('390-selected', '/works/panel-paint?part=범퍼&utm_source=local-test');
      await layout('1440-selected', '/works/panel-paint?part=범퍼&utm_source=local-test', 1440);
      await layout('320-selected', '/works/panel-paint?part=범퍼', 320);
    });
    if (!baseline && !historyOnly) {
      await t.test('selection, reset, preserved UTM, history, events, images and edit links', async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await open('/works?utm_source=local-test&utm_campaign=filter&custom=keep');
        const checks = sessionChecks;
        assert.equal((await events()).length, 0);
        assert.equal(await page.getByText('선택 초기화', { exact: true }).count(), 0);
        await checkCards();
        await categoryLink('판금도색').click();
        await checkCards('panel-paint');
        await partLink('범퍼').click();
        await checkCards('panel-paint', '범퍼');
        assert.match(await page.locator('.works-count').innerText(), new RegExp(`판금도색 · 범퍼 사례\\s*${matching('panel-paint', '범퍼').length}건`));
        const selectedUrl = page.url();
        const selectedCards = await cardLinks();
        const selectedImages = await page.locator('.work-card img').evaluateAll(els => els.map(el => el.getAttribute('src')));
        assert.equal(new URL(selectedUrl).searchParams.get('utm_source'), 'local-test');
        assert.equal(new URL(selectedUrl).searchParams.get('custom'), 'keep');
        assert.equal((await events()).length, 2);
        assert.equal(await page.locator('.work-filter-swipe-hint').count(), 2, 'hints survive clicks and automatic rail scrolling');
        await page.locator('.work-part-filter').evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }));
        assert.equal(await page.locator('.work-filter-swipe-hint').count(), 2, 'hints persist at rail end');
        const reset = page.getByText('선택 초기화', { exact: true });
        await page.keyboard.press('Tab'); // Enter keyboard modality before testing :focus-visible.
        await reset.focus();
        assert.equal(await reset.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
        await page.keyboard.press('Enter');
        await checkCards();
        assert.equal(new URL(page.url()).pathname, '/works');
        assert.equal(new URL(page.url()).searchParams.has('part'), false);
        assert.equal(new URL(page.url()).searchParams.get('utm_campaign'), 'filter');
        assert.equal((await events()).length, 3);
        assert.deepEqual((await events()).at(-1)[2], { category: '전체', part: '전체' });
        await page.goBack();
        await page.waitForFunction(url => location.href === url, selectedUrl);
        await checkCards('panel-paint', '범퍼');
        assert.deepEqual(await cardLinks(), selectedCards);
        assert.deepEqual(await page.locator('.work-card img').evaluateAll(els => els.map(el => el.getAttribute('src'))), selectedImages);
        assert.equal((await events()).length, 3, 'history must not emit filter_use');
        assert.equal(sessionChecks, checks, 'filtering must not refetch admin session');
        assert.equal(await page.locator('.work-card-edit-link').count(), selectedCards.length);
        assert.equal(await page.locator('.work-card-edit-link').first().getAttribute('target'), '_blank');
        assert.equal(await page.locator('.work-card a').count(), 0);
        await page.goForward();
        await checkCards();
        assert.equal((await events()).length, 3);
        await page.goBack();
        await checkCards('panel-paint', '범퍼');
        await partLink('범퍼').click();
        await checkCards('panel-paint');
        assert.equal((await events()).length, 4, 'same part deselects once');
        for (const selector of ['.work-category-tabs a', '.work-part-filter a', '.works-filter-reset']) {
          assert(await page.locator(selector).first().evaluate(el => el.getBoundingClientRect().height >= 44));
        }
      });
      await t.test('part-only result and unavailable part preserve existing URL recovery', async () => {
        await open('/works?part=범퍼&utm_source=local-test');
        await checkCards(undefined, '범퍼');
        assert.match(await page.locator('.works-count').innerText(), new RegExp(`범퍼 사례\\s*${matching(undefined, '범퍼').length}건`));
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.acedentshop.co.kr/works');
        await open('/works/dent?part=차량 전체&utm_source=local-test');
        await checkCards('dent');
        assert.equal(new URL(page.url()).searchParams.has('part'), false);
        assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'local-test');
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.acedentshop.co.kr/works/dent');
        assert.equal((await events()).length, 0, 'URL recovery is not a user filter click');
        assert.equal(await page.locator('.works-category-guide[open]').count(), 0);
      });
      await t.test('static intro, labels, condition count and unchanged detail links', () => {
        for (const [category, part] of [[undefined, undefined], ['dent', undefined], ['panel-paint', '범퍼']]) {
          const html = getWorksStaticHtml(works, category, part);
          assert(html.includes(intro));
          assert(html.includes('어떤 작업이 궁금하세요?'));
          assert.equal(html.includes('어디가 손상됐나요?'), html.includes('aria-label="수리 부위"'), 'only label the existing part-link group');
          assert(html.includes(`${matching(category, part).length}건`));
          assert.equal(html.includes('선택 초기화'), Boolean(category || part));
          const links = [...html.matchAll(/class="seo-work-card">\s*<a href="([^"]+)"/g)].map(m => m[1]);
          assert.deepEqual(links, matching(category, part).map(w => `/works/detail/${w.slug}`));
        }
        const empty = getWorksStaticHtml([], 'dent', '범퍼');
        assert(empty.includes('덴트(무도색) · 범퍼 사례'));
        assert(empty.includes('0건'));
        assert(empty.includes('수리 가능 여부와는 다릅니다.'));
        assert(empty.includes('선택 초기화'));
      });
      const previousFile = resolve(output, 'baseline.json');
      if (existsSync(previousFile)) {
        const previous = JSON.parse(readFileSync(previousFile, 'utf8'));
        for (const name of ['390-default', '390-dent']) {
          const old = previous.layouts.find(l => l.name === name);
          const current = layouts.find(l => l.name === name);
          assert.equal(current.count, old.count, 'baseline and new UI must use identical cases');
          assert(current.firstPhotoY <= old.firstPhotoY, `${name}: first photo must not move down`);
        }
      }
    }
    if (!baseline) for (const [path, category, part] of [
      ['/works/dent', 'dent', undefined],
      ['/works/panel-paint/bumper', 'panel-paint', '범퍼'],
    ]) {
      await t.test(`direct ${path}: reset/back/forward restores URL, not initial route props`, async () => {
        await open(`${path}?utm_source=history-test&custom=keep`);
        const checks = sessionChecks;
        async function state(step, expectedPath, expectedCategory, expectedPart) {
          // Settle React effects triggered by this history event, not a fixed delay.
          await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
          const snapshot = await page.evaluate(() => ({
            path: location.pathname,
            search: location.search,
            category: document.querySelector('.work-category-tabs a.is-active')?.textContent.trim(),
            part: document.querySelector('.work-part-filter a.is-active')?.textContent.trim(),
            result: document.querySelector('.works-count > span')?.textContent.trim(),
            count: document.querySelectorAll('.work-card').length,
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
            events: window.__events.filter(event => event[1] === 'filter_use'),
          }));
          historyStates.push({ entry: path, step, ...snapshot });
          assert.equal(snapshot.path, expectedPath);
          const search = new URLSearchParams(snapshot.search);
          assert.equal(search.get('utm_source'), 'history-test');
          assert.equal(search.get('custom'), 'keep');
          const { getWorkCategoryLabel } = loadTs('content/works/types.ts');
          const categoryLabel = expectedCategory ? getWorkCategoryLabel(expectedCategory) : '전체';
          assert.equal(snapshot.category, categoryLabel);
          assert.equal(snapshot.part, expectedPart || '전체');
          assert.equal(snapshot.count, matching(expectedCategory, expectedPart).length);
          const label = expectedCategory || expectedPart
            ? `${[expectedCategory ? categoryLabel : '', expectedPart].filter(Boolean).join(' · ')} 사례`
            : '전체 수리사례';
          assert.equal(snapshot.result, `${label} ${snapshot.count}건`);
          assert.equal(snapshot.canonical, `https://www.acedentshop.co.kr${expectedPath}`);
          assert.equal(snapshot.events.length, step === 'entry' ? 0 : 1);
          if (snapshot.events.length) assert.deepEqual(snapshot.events[0][2], { category: '전체', part: '전체' });
          assert.equal(sessionChecks, checks);
        }
        await state('entry', path, category, part);
        await page.getByText('선택 초기화', { exact: true }).click();
        await state('reset', '/works');
        await page.goBack();
        await state('back', path, category, part);
        await page.goForward();
        await state('forward', '/works');
      });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(blocked, []);
    writeFileSync(resolve(output, baseline ? 'baseline.json' : `${reportName}.json`), JSON.stringify({ layouts, historyStates, errors, blocked, localPhotoPlaceholders: true }, null, 2));
    console.log(JSON.stringify(layouts));
  } finally { await browser?.close(); await server.close(); }
});
