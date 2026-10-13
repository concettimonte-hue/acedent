import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { setMaxListeners } from 'node:events';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
const browserGlobals = new Map(['window', 'document', 'fetch', 'setTimeout', 'clearTimeout'].map(name => [name, globalThis[name]]));
function browserFixture(t, fetcher) {
  const timers = new Map();
  let sequence = 0;
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  // Stress fixture only: production mounts one gallery observer, not 50.
  setMaxListeners(0, globalThis.window, globalThis.document);
  globalThis.fetch = fetcher;
  globalThis.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => { for (const [name, value] of browserGlobals) { if (value === undefined) delete globalThis[name]; else globalThis[name] = value; } });
  return { timers, ...loadTs('lib/admin-session.ts', { fresh: true }) };
}

test('one delayed request is shared by 50 cards/remounts, starts hidden, never gates rendering', async t => {
  let release;
  let requests = 0;
  const response = new Promise(resolve => { release = resolve; });
  const fixture = browserFixture(t, (url, options) => {
    requests++;
    assert.equal(url, '/admin/api/session');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.mode, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert(!options.headers, 'No token/analytics cookie copied into headers');
    return response;
  });
  const states = Array(50).fill(null);
  const stops = states.map((_, i) => fixture.observeAdminSession(value => { states[i] = value; }));
  assert(states.every(value => value === false));
  assert.equal(requests, 1);
  // Models StrictMode cleanup/remount without a second request or stale callback.
  stops[0]();
  release(Response.json({ authenticated: true, expiresAt: Date.now() + 120_000 }));
  await flush();
  assert.equal(states[0], false);
  assert(states.slice(1).every(value => value === true));
  stops.push(fixture.observeAdminSession(value => { states[0] = value; }));
  await flush();
  assert.equal(states[0], true);
  assert.equal(requests, 1);
  stops.forEach(stop => stop());
  assert.equal(fixture.timers.size, 0);
});

test('guest/failure/redirect HTML/malformed/expired responses stay hidden without retries', async t => {
  const cases = [
    () => Response.json({ authenticated: false }, { status: 403 }),
    () => Response.json({ authenticated: false }, { status: 503 }),
    () => new Response('<html>Access login</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('not json', { headers: { 'Content-Type': 'application/json' } }),
    () => Response.json({ authenticated: true, expiresAt: Date.now() - 1 }),
    () => Response.json({ authenticated: true }),
    () => Response.json({ authenticated: 'true', expiresAt: Date.now() + 120000 }),
    () => { throw new TypeError('Login redirect/offline'); },
    () => { const response = Response.json({ authenticated: true, expiresAt: Date.now() + 120000 }); Object.defineProperty(response, 'redirected', { value: true }); return response; },
  ];
  for (const fetcher of cases) {
    let calls = 0;
    const fixture = browserFixture(t, async () => { calls++; return fetcher(); });
    const states = [];
    const stop = fixture.observeAdminSession(value => states.push(value));
    await flush();
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
    assert(states.every(value => value === false));
    assert.equal(calls, 1);
    stop();
    assert.equal(fixture.timers.size, 0);
  }
});

test('timeout aborts once and never exposes editing', async t => {
  let aborted = false;
  const fixture = browserFixture(t, (_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('timeout')); });
  }));
  let visible;
  const stop = fixture.observeAdminSession(value => { visible = value; });
  assert.equal(visible, false);
  [...fixture.timers.values()].find(item => item.delay === 4000).callback();
  await flush();
  assert(aborted);
  assert.equal(visible, false);
  stop();
  assert.equal(fixture.timers.size, 0);
});

test('expiry and background/BFCache return hide editing without polling', async t => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  t.after(() => { Date.now = originalNow; });
  let requests = 0;
  const fixture = browserFixture(t, async () => { requests++; return Response.json({ authenticated: true, expiresAt: now + 1000 }); });
  let visible;
  const stop = fixture.observeAdminSession(value => { visible = value; });
  await flush();
  assert.equal(visible, true);
  assert.equal([...fixture.timers.values()][0].delay, 1000);
  now += 1001;
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(visible, false);
  assert.equal(requests, 1);
  stop();
  assert.equal(fixture.timers.size, 0);
});

test('public card unchanged by default; edit link is a sibling with no public analytics handler', () => {
  const WorkCard = loadTs('components/WorkCard.tsx').default;
  const work = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8')).records[0].work;
  const publicHtml = renderToStaticMarkup(createElement(WorkCard, { work }));
  assert(!publicHtml.includes('/admin'));
  assert.equal((publicHtml.match(/<a\b/g) || []).length, 1);
  const editable = WorkCard({ work, canEdit: true });
  assert.equal(editable.type, 'div');
  const [detail, edit] = editable.props.children;
  assert.equal(detail.type, 'a');
  assert.equal(edit.type, 'a');
  assert.equal(edit.props.href, `/admin?view=edit&slug=${encodeURIComponent(work.slug)}`);
  assert.equal(edit.props.target, '_blank');
  assert.equal(edit.props.rel, 'noopener noreferrer');
  assert.equal(edit.props.onClick, undefined);
  assert.equal(typeof detail.props.onClick, 'function');
  const gallery = readFileSync(new URL('../components/WorksGalleryPage.tsx', import.meta.url), 'utf8');
  assert.equal((gallery.match(/observeAdminSession\(setCanEdit\)/g) || []).length, 1);
  assert.match(gallery, /canEdit=\{canEdit\}/);
  const router = readFileSync(new URL('../components/SiteRouter.tsx', import.meta.url), 'utf8');
  assert.match(router, /lazy\(\(\) => import\('@\/components\/AdminPage'\)\)/);
});
