// Isolated localhost fixture; no connected Chrome profile, production data or API.
// Set PLAYWRIGHT_MODULE_PATH to an installed Playwright ESM entry when needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const fixtureId = '/slider-hint-fixture.js';
const photo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#555"/></svg>')}`;

await test('comparison hint: actual React pointer/keyboard/split/zoom on localhost', async (t) => {
  const server = await createServer({
    root, configFile: false, envFile: false,
    resolve: { alias: { '@': root } },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [react(), {
      name: 'isolated-slider-hint-fixture',
      resolveId(id) { if (id === fixtureId) return `\0${fixtureId}`; },
      load(id) {
        if (id !== `\0${fixtureId}`) return;
        return `import React from 'react';
          import { createRoot } from 'react-dom/client';
          import BeforeAfterSlider from '/components/BeforeAfterSlider.tsx';
          import '/app/globals.css';
          const query = new URLSearchParams(location.search);
          createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode, null,
            React.createElement(BeforeAfterSlider, {
              beforeSrc: ${JSON.stringify(photo)}, afterSrc: ${JSON.stringify(photo)},
              beforeAlt: '로컬 수리 전', afterAlt: '로컬 수리 후',
              mode: query.get('mode') || 'drag', showHint: query.get('hint') !== 'off', enableZoom: true
            })));
        `;
      },
      configureServer(vite) {
        vite.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith('/fixture')) return next();
          const html = await vite.transformIndexHtml(request.url, `<!doctype html><html><head>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{margin:0;padding:16px}main{max-width:1000px;margin:auto}</style>
            </head><body><main id="root"></main><script type="module" src="${fixtureId}"></script></body></html>`);
          response.setHeader('Content-Type', 'text/html');
          response.end(html);
        });
      },
    }],
  });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  let browser;
  const errors = [];
  const external = [];
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
    context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
    await context.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === 'GET' && (url.origin === origin || url.protocol === 'data:')) return route.continue();
      external.push(`${request.method()} ${url.origin}${url.pathname}`);
      return route.abort();
    });
    const page = await context.newPage();
    async function open(query = '') {
      await page.goto(`${origin}/fixture${query}`);
      await page.locator('.before-after-slider').waitFor();
    }
    const slider = page.locator('[role="slider"]');
    const hint = page.locator('.comparison-hint');
    async function expectHint(hidden) {
      // Keep the existing 420ms fade; wait for presentation as well as React state.
      await page.waitForFunction((hidden) => {
        const el = document.querySelector('.comparison-hint');
        return el && el.classList.contains('is-hidden') === hidden &&
          getComputedStyle(el).opacity === (hidden ? '0' : '1');
      }, hidden);
    }
    async function clickAt(percent) {
      const box = await slider.boundingBox();
      const x = box.x + box.width * percent / 100;
      const y = box.y + box.height / 2;
      if (page.viewportSize().width < 500) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
    for (const width of [320, 390, 1280]) {
      await t.test(`${width}px: center/jitter keep hint; real movement hides it`, async () => {
        await page.setViewportSize({ width, height: 1000 });
        await open();
        await clickAt(50);
        await clickAt(50);
        assert.equal(await slider.getAttribute('aria-valuenow'), '50');
        await expectHint(false);
        for (const percent of [51, 49, 51, 49, 51.8]) await clickAt(percent);
        await expectHint(false); // Do not accumulate small repeated movements.
        await clickAt(52.2);
        await expectHint(true);
        await clickAt(50);
        await expectHint(true); // Keep it dismissed after successful use.
      });
    }
    await t.test('dragging left, release/cancel, hover and invalid bounds preserve existing controls', async () => {
      await open();
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
      assert.equal(await slider.getAttribute('aria-valuenow'), '50');
      await expectHint(false);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await slider.evaluate((el) => {
        el.savedBounds = el.getBoundingClientRect;
        el.getBoundingClientRect = () => ({ left: 0, width: 0 });
      });
      await page.mouse.move(box.x + box.width * .3, box.y + box.height / 2);
      assert.equal(await slider.getAttribute('aria-valuenow'), '50');
      await expectHint(false);
      await slider.evaluate((el) => { el.getBoundingClientRect = el.savedBounds; });
      await page.mouse.move(box.x + box.width * .47, box.y + box.height / 2);
      await expectHint(true);
      const moved = await slider.getAttribute('aria-valuenow');
      assert.equal(moved, '47');
      await slider.dispatchEvent('pointercancel', { pointerId: 1 });
      await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
      await page.mouse.up();
      assert.equal(await slider.getAttribute('aria-valuenow'), moved);
    });
    await t.test('keyboard: unrelated keys keep hint; arrows move by 5 and clamp at endpoints', async () => {
      await open();
      await slider.focus();
      for (const key of ['Enter', 'Home', 'Escape']) await page.keyboard.press(key);
      assert.equal(await slider.getAttribute('aria-valuenow'), '50');
      await expectHint(false);
      await page.keyboard.press('ArrowLeft');
      assert.equal(await slider.getAttribute('aria-valuenow'), '45');
      await expectHint(true);
      await page.keyboard.press('ArrowRight');
      assert.equal(await slider.getAttribute('aria-valuenow'), '50');
      await expectHint(true);
      for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowRight');
      assert.equal(await slider.getAttribute('aria-valuenow'), '100');
      for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowLeft');
      assert.equal(await slider.getAttribute('aria-valuenow'), '0');
    });
    await t.test('zoom open/close does not dismiss the hint or move the slider', async () => {
      await open();
      await page.getByRole('button', { name: '전후 사진 크게 보기' }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      assert.equal(await slider.getAttribute('aria-valuenow'), '50');
      await expectHint(false);
      // The unchanged viewer restores focus on the next animation frame.
      await page.waitForFunction(() => document.activeElement?.className === 'before-after-zoom-trigger');
    });
    await t.test('split panels and zoom stay intact; showHint=false renders no guidance', async () => {
      await open('?mode=split');
      assert.equal(await slider.count(), 0);
      assert.equal(await page.locator('.before-after-panel').count(), 2);
      await expectHint(false);
      await page.getByRole('button', { name: '전후 사진 크게 보기' }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await expectHint(false);
      await open('?hint=off');
      assert.equal(await hint.count(), 0);
      await clickAt(70);
      assert.equal(await slider.getAttribute('aria-valuenow'), '70');
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], 'Fixture must not attempt external requests or writes');
  } finally {
    await browser?.close();
    await server.close();
  }
});
