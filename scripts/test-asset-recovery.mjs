import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../lib/asset-recovery.js', import.meta.url), 'utf8');

function page({ path = '/works?part=범퍼#results', storage = new Map(), blockedStorage = false, offline = false, body = true } = {}) {
  const listeners = new Map();
  const domListeners = new Map();
  const notices = [];
  const navigations = [];
  const histories = [];
  function element(tagName) {
    return { tagName, style: {}, children: [], listeners: {}, setAttribute() {},
      append(...children) { this.children.push(...children); },
      addEventListener(name, fn) { this.listeners[name] = fn; } };
  }
  const doc = { body: body ? { appendChild: node => notices.push(node) } : null,
    createElement: element, addEventListener: (name, fn) => domListeners.set(name, fn) };
  const win = {
    location: { href: new URL(path, 'https://www.acedentshop.co.kr').href, replace: url => navigations.push(url) },
    history: { state: { existing: true }, replaceState(state, _, url) { histories.push({ state, url }); win.location.href = url; } },
    navigator: { onLine: !offline }, confirm: () => false,
    sessionStorage: {
      getItem(key) { if (blockedStorage) throw Error('blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blockedStorage) throw Error('blocked'); storage.set(key, value); },
    },
    addEventListener: (name, fn) => listeners.set(name, fn),
  };
  runInNewContext(source, { window: win, document: doc, URL, WeakSet, Date });
  return { win, doc, notices, navigations, histories,
    error: target => listeners.get('error')({ target }),
    preload: () => listeners.get('vite:preloadError')(),
    ready() { doc.body = { appendChild: node => notices.push(node) }; domListeners.get('DOMContentLoaded')?.(); },
  };
}
const entry = () => ({ tagName: 'SCRIPT', type: 'module', src: 'https://www.acedentshop.co.kr/assets/index-old.js' });
const css = () => ({ tagName: 'LINK', rel: 'stylesheet', href: 'https://www.acedentshop.co.kr/assets/index-old.css' });

test('normal load makes no request/navigation and ignores images, external tags and runtime errors', () => {
  const p = page();
  p.error({ tagName: 'IMG', src: '/photo.jpg' });
  p.error({ ...entry(), src: 'https://example.com/assets/index-old.js' });
  p.error({ ...entry(), src: '/admin/api/works' });
  p.error(p.win);
  assert.equal(p.navigations.length, 0);
  assert.equal(p.notices.length, 0);
});

test('failed CSS alone is retried once without a page reload', () => {
  const p = page(); const link = css();
  p.error(link);
  assert.match(link.href, /index-old\.css\?__acedent_asset_retry=\d+$/);
  assert.equal(p.navigations.length, 0);
  p.error(link);
  assert.equal(p.navigations.length, 1);
});

test('entry failure reloads once, keeping filter selection and anchor', () => {
  const p = page(); p.error(entry()); p.error(entry()); p.preload();
  assert.equal(p.navigations.length, 1);
  const url = new URL(p.navigations[0]);
  assert.equal(url.searchParams.get('part'), '범퍼'); assert.equal(url.hash, '#results');
});

test('retry marker prevents a reload loop even with unavailable storage and is removed before analytics', () => {
  const p = page({ blockedStorage: true }); p.error(entry());
  const next = page({ path: p.navigations[0], blockedStorage: true }); next.error(entry()); next.preload();
  assert.equal(next.navigations.length, 0); assert.equal(next.notices.length, 1);
  assert.equal(new URL(next.histories[0].url).searchParams.has('__acedent_asset_retry'), false);
  assert.equal(new URL(next.histories[0].url).searchParams.get('part'), '범퍼');
  assert.deepEqual(next.histories[0].state, { existing: true });
});

test('session guard also stops loops after navigation to another public route', () => {
  const storage = new Map(); const p = page({ storage }); p.preload();
  const next = page({ storage, path: '/works/dent' }); next.error(entry());
  assert.equal(next.navigations.length, 0); assert.equal(next.notices.length, 1);
});

test('admin preserves unsaved input, retries CSS only, and requires confirmation for manual reload', () => {
  const p = page({ path: '/admin?view=edit&slug=existing' }); const link = css();
  const unsaved = { title: '아직 저장하지 않은 제목' }; p.doc.form = unsaved;
  p.error(link); p.error(link); p.error(entry()); p.preload();
  assert.equal(p.navigations.length, 0); assert.equal(p.notices.length, 1);
  assert.equal(p.doc.form, unsaved);
  const button = p.notices[0].children[1]; button.listeners.click();
  assert.equal(p.navigations.length, 0);
  p.win.confirm = () => true; button.listeners.click();
  assert.equal(new URL(p.navigations[0]).searchParams.get('slug'), 'existing');
});

test('early parsing errors render notice once after body exists; offline/preview pages never auto reload', () => {
  const p = page({ path: '/admin', body: false }); p.error(entry()); p.preload();
  assert.equal(p.notices.length, 0); p.ready(); assert.equal(p.notices.length, 1);
  for (const options of [{ offline: true }, { path: '/preview/admin' }]) {
    const q = page(options); q.error(entry()); assert.equal(q.navigations.length, 0); assert.equal(q.notices.length, 1);
  }
});

test('Vite build installs independent recovery before assets, and no-cache does not target admin APIs', () => {
  const config = readFileSync(new URL('../vite.static.config.ts', import.meta.url), 'utf8');
  assert.match(config, /order: 'post'/); assert.match(config, /html\.replace\('<head>'/);
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.match(headers, /\/assets\/\*\s+Cache-Control: no-cache, max-age=0, must-revalidate/);
  assert.doesNotMatch(headers, /\/admin\/\*/);
});
