import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startComparisonPreview } from './preview-work-comparisons.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const output = fileURLToPath(new URL('../outputs/comparison-annotations/', import.meta.url));
mkdirSync(output, { recursive: true });

await test('isolated admin and public comparison interactions at desktop/390/320px', async t => {
  const preview = await startComparisonPreview();
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  t.after(async () => { await browser.close(); await preview.server.close(); });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === preview.origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${preview.origin}/preview/admin`);
  const editor = page.locator('.admin-comparison-editor');
  await editor.waitFor().catch(error => { throw new Error(`${error.message}\nPage errors: ${errors.join('; ')}`); });
  assert.equal(await editor.locator('.admin-comparison-item').count(), 2);
  assert.equal(await page.locator('.admin-detail-preview .work-additional-comparison').count(), 2);
  assert.equal(await editor.locator('.admin-image-input .work-image-annotations').count(), 1);
  await editor.getByRole('button', { name: '전후 비교 추가', exact: true }).click();
  assert.equal(await editor.getByRole('button', { name: '전후 비교 추가', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: '사례 수정 및 배포', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '추가 비교의 전·후 사진' }).waitFor();
  assert.equal(preview.getSavedPayload(), undefined, 'incomplete pair must not save/upload');
  await editor.getByRole('button', { name: '추가 비교 3 삭제', exact: true }).click();
  const caption = editor.getByRole('textbox').first();
  await caption.fill('측면에서 본 전후 결과');
  await editor.getByRole('button', { name: '추가 비교 2 위로', exact: true }).click();
  assert.equal(await editor.getByRole('textbox').nth(1).inputValue(), '측면에서 본 전후 결과');
  assert.equal(await editor.locator('.admin-comparison-item').nth(1).locator('.work-image-annotations').count(), 1, 'marks follow the pair when reordered');
  await editor.getByRole('button', { name: '추가 비교 1 삭제', exact: true }).click();
  const beforeFile = fileURLToPath(new URL('../public/works/jeep-renegade-door-dent-before.jpg', import.meta.url));
  await editor.getByLabel('추가 비교 1 BEFORE 사진', { exact: true }).setInputFiles(beforeFile);
  await page.waitForFunction(() => document.querySelector('.admin-comparison-item img')?.getAttribute('src')?.startsWith('blob:'));
  assert.equal(await editor.locator('.work-image-annotations').count(), 0, 'replacing BEFORE clears only its marks');
  await editor.getByRole('button', { name: '추가 비교 1 손상 위치 표시', exact: true }).click();
  const draw = async (tool) => {
    await editor.getByRole('button', { name: tool, exact: true }).click();
    const stage = editor.locator('.admin-annotation-stage'); await stage.scrollIntoViewIfNeeded();
    const box = await stage.boundingBox(); assert(box);
    await page.mouse.move(box.x + box.width * .15, box.y + box.height * .3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .38, box.y + box.height * .5, { steps: 5 });
    await page.mouse.up();
  };
  await draw('화살표'); await draw('원'); await draw('화살표'); await draw('원');
  assert.equal(await editor.locator('.admin-annotation-list button').count(), 3, 'fourth annotation is blocked');
  await editor.getByRole('button', { name: '실행 취소', exact: true }).click();
  assert.equal(await editor.locator('.admin-annotation-list button').count(), 2);
  await editor.getByLabel('추가 비교 1 AFTER 사진', { exact: true }).evaluate(async input => {
    const bytes = await (await fetch('/works/jeep-renegade-door-dent-after.jpg')).blob();
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'drop-after.jpg', { type: 'image/jpeg' }));
    input.closest('label').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  });
  await page.waitForFunction(() => [...document.querySelectorAll('.admin-comparison-item .admin-image-input img')].every(img => img.getAttribute('src')?.startsWith('blob:')));
  assert.equal(await editor.locator('.admin-annotation-list button').count(), 2, 'AFTER replacement preserves BEFORE marks');
  assert.equal(await page.locator('.admin-detail-preview .work-additional-comparison .work-image-annotation-mark').count(), 2);
  assert.equal(await page.locator('.admin-detail-preview > .work-detail-part > .work-detail-slider .work-image-annotations').count(), 0, 'no propagation into parent');
  await page.getByRole('button', { name: '사례 수정 및 배포', exact: true }).click();
  await page.getByRole('link', { name: '사례 페이지로 가기' }).waitFor({ timeout: 15000 });
  const saved = preview.getSavedPayload();
  assert.equal(saved.parts.length, 1);
  assert.equal(saved.parts[0].comparisons.length, 1);
  assert.equal(saved.parts[0].comparisons[0].caption, '측면에서 본 전후 결과');
  assert.deepEqual(saved.parts[0].comparisons[0].beforeAnnotations.map(mark => mark.type), ['arrow', 'circle']);
  assert(saved.parts[0].comparisons[0].before.key.includes('comparison-'));
  assert.equal(saved.parts[0].before.key, 'works/local-preview/fixture-before.jpg');
  assert.equal(saved.parts[0].category, 'dent');
  assert.equal(preview.getUploads().size, 2, 'only changed extra photos upload; primary OG untouched');
  assert([...preview.getUploads().values()].every(bytes => bytes.length <= 200000));
  await editor.scrollIntoViewIfNeeded();
  await editor.screenshot({ path: `${output}/admin-comparison-desktop.png` });
  await page.locator('.admin-detail-preview .work-detail-part').screenshot({ path: `${output}/admin-detail-preview.png` });

  for (const width of [390, 320]) {
    await t.test(`${width}px admin: no horizontal overflow`, async () => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${preview.origin}/preview/admin`); await editor.waitFor();
      await editor.getByRole('button', { name: '추가 비교 1 손상 위치 표시', exact: true }).click();
      await draw('원');
      assert.equal(await editor.locator('.admin-annotation-list button').count(), 2);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 390) await editor.screenshot({ path: `${output}/admin-comparison-mobile.png` });
    });
  }
  for (const width of [1440, 390, 320]) {
    await t.test(`${width}px public: slider, zoom, captions and legacy empty state`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${preview.origin}/preview/detail`);
      const pairs = page.locator('.work-additional-comparison'); await pairs.first().waitFor();
      assert.equal(await pairs.count(), 2);
      assert.equal(await pairs.locator('figcaption').count(), 1);
      assert.equal(await pairs.first().locator('figcaption').evaluate(el => getComputedStyle(el).fontSize), width <= 640 ? '16px' : '18px');
      assert.equal(await pairs.first().locator('.work-image-annotations').count(), 1);
      assert.equal(await pairs.nth(1).locator('.work-image-annotations').count(), 0);
      assert.equal(await page.locator('.work-detail-part').count(), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const slider = pairs.first().getByRole('slider'); await slider.focus(); await page.keyboard.press('ArrowRight');
      assert(Number(await slider.getAttribute('aria-valuenow')) > 50);
      assert.equal(await pairs.nth(1).getByRole('slider').getAttribute('aria-valuenow'), '50');
      await pairs.first().getByRole('button', { name: /크게/ }).click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      assert.equal(await dialog.locator('.work-image-annotations').count(), 0, 'AFTER has no annotations');
      await dialog.getByRole('button', { name: 'BEFORE', exact: true }).click();
      assert.equal(await dialog.locator('.work-image-annotations').count(), 1);
      await dialog.getByRole('button', { name: '확대', exact: true }).click();
      assert.equal(await dialog.locator('.work-image-annotation-mark').count(), 1);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      if (width === 390) await page.locator('.work-detail-part').screenshot({ path: `${output}/public-detail-mobile.png` });
      if (width === 1440) await pairs.first().screenshot({ path: `${output}/public-comparison-desktop.png` });
      await page.goto(`${preview.origin}/preview/detail?empty=1`);
      await page.locator('.work-detail-part').waitFor();
      assert.equal(await page.locator('.work-additional-comparisons').count(), 0);
      assert.equal(await page.locator('.work-detail-part [role="slider"]').count(), 1);
    });
  }
  assert.deepEqual(errors, []);
});
