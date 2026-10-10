import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';

const { observeWorksContactVisibility } = loadTs('lib/works-contact.ts');
const FloatingContact = loadTs('components/WorksFloatingContact.tsx').default;

test('disclosure starts closed, has native links and no event on render', () => {
  const html = renderToStaticMarkup(createElement(FloatingContact, { workSlug: 'fixture' }));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-label="빠른 수리 상담" hidden=""/);
  assert.match(html, /문자로 사진 보내기/);
  assert.match(html, /href="sms:/);
  assert.match(html, /href="tel:/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert(html.indexOf('사진 상담') < html.indexOf('전화 문의'));
  assert(html.indexOf('전화 문의') < html.indexOf('네이버 톡톡'));
});

test('only public gallery and detail mount the shared floating contact', () => {
  const read = name => readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
  assert.match(read('WorksGalleryPage'), /<WorksFloatingContact \/>/);
  assert.match(read('WorkDetailPage'), /<WorksFloatingContact workSlug=\{work.slug\} \/>/);
  assert.doesNotMatch(read('AdminPage'), /WorksFloatingContact/);
  assert.doesNotMatch(read('SiteRouter'), /WorksFloatingContact/);
});

test('inline CTA, colliding photo controls and image portals are observed and cleaned up', () => {
  const observers = [];
  const listeners = new Map();
  const inline = {};
  const zoom = {};
  let hasModal = false;
  let modalObserver;
  const originals = Object.fromEntries(['window', 'document', 'IntersectionObserver', 'MutationObserver'].map(k => [k, globalThis[k]]));
  try {
    globalThis.window = {
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: name => listeners.delete(name),
    };
    globalThis.document = {
      body: {}, documentElement: { clientWidth: 390, clientHeight: 844 },
      // Test doubles, not calls to deprecated DOM tag overloads.
      // oxlint-disable-next-line typescript/no-deprecated
      querySelectorAll: selector => selector === '[data-work-contact-inline]' ? [inline] : [zoom],
      // oxlint-disable-next-line typescript/no-deprecated
      querySelector: () => hasModal ? {} : null,
    };
    globalThis.IntersectionObserver = class {
      constructor(callback, options) { Object.assign(this, { callback, options, targets: [], disconnected: false }); observers.push(this); }
      observe(target) { this.targets.push(target); }
      disconnect() { this.disconnected = true; }
    };
    globalThis.MutationObserver = class {
      constructor(callback) { this.callback = callback; modalObserver = this; }
      observe(target, options) { this.options = options; }
      disconnect() { this.disconnected = true; }
    };
    let state;
    const stop = observeWorksContactVisibility({ getBoundingClientRect: () => ({ top: 772, bottom: 828, left: 318, right: 374 }) }, next => { state = next; });
    assert.deepEqual(observers[0].targets, [inline]);
    assert.equal(observers[1].options.rootMargin, '-764px -8px -8px -310px');
    observers[0].callback([{ target: inline, isIntersecting: true, intersectionRatio: 0.6 }]);
    assert.equal(state.inline, true);
    observers[0].callback([{ target: inline, isIntersecting: false, intersectionRatio: 0 }]);
    assert.equal(state.inline, false);
    observers[1].callback([{ target: zoom, isIntersecting: true }]);
    assert.equal(state.collision, true);
    observers[1].callback([{ target: zoom, isIntersecting: false }]);
    assert.equal(state.collision, false);
    assert.deepEqual(modalObserver.options, { childList: true });
    hasModal = true; modalObserver.callback(); assert.equal(state.modal, true);
    hasModal = false; modalObserver.callback(); assert.equal(state.modal, false);
    listeners.get('resize')(); assert.equal(observers[1].disconnected, true);
    stop();
    assert(observers.every(observer => observer.disconnected));
    assert.equal(modalObserver.disconnected, true);
    assert.equal(listeners.size, 0);
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
