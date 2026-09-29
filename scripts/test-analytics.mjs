import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../lib/analytics.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: 'analytics.ts',
});
const analytics = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

function installBrowser(pathname = '/works/detail/sample-work', cookie = '') {
  const gtagCalls = [];
  const clarityCalls = [];
  globalThis.window = {
    location: {
      pathname,
      search: '?utm_source=qa',
      href: `https://www.acedentshop.co.kr${pathname}?utm_source=qa`,
    },
    gtag: (...args) => gtagCalls.push(args),
    clarity: (...args) => clarityCalls.push(args),
  };
  globalThis.document = { cookie, title: 'QA' };
  return { gtagCalls, clarityCalls };
}

function eventCalls(calls) {
  return calls.map(([, name, params]) => ({ name, params }));
}

test('tel click emits one channel event and one contact intent with context', () => {
  const { gtagCalls, clarityCalls } = installBrowser();

  analytics.trackTelClick('work_detail_contact', 'sample-work');

  assert.deepEqual(eventCalls(gtagCalls), [
    {
      name: 'tel_click',
      params: {
        page_path: '/works/detail/sample-work',
        placement: 'work_detail_contact',
        work_slug: 'sample-work',
        transport_type: 'beacon',
        location: '하단',
      },
    },
    {
      name: 'contact_intent',
      params: {
        page_path: '/works/detail/sample-work',
        placement: 'work_detail_contact',
        work_slug: 'sample-work',
        contact_method: 'tel',
        transport_type: 'beacon',
      },
    },
  ]);
  assert.deepEqual(clarityCalls, [['set', 'conversion', 'tel']]);
});

test('sms and talk clicks each emit exactly one matching contact intent', () => {
  const { gtagCalls, clarityCalls } = installBrowser('/works');
  const talkDestination = 'https://talk.naver.com/wc55qv';

  analytics.trackSmsClick('works_sticky');
  analytics.trackTalkClick('works_sticky', talkDestination);

  const events = eventCalls(gtagCalls);
  assert.deepEqual(events.map(({ name }) => name), [
    'sms_click',
    'contact_intent',
    'talk_click',
    'contact_intent',
  ]);
  assert.equal(events[1].params.contact_method, 'sms');
  assert.equal(events[2].params.destination, talkDestination);
  assert.equal(events[3].params.contact_method, 'talk');
  assert.deepEqual(clarityCalls, [['set', 'conversion', 'sms']]);
});

test('booking emits contact intent while place, blog, and review do not', () => {
  const { gtagCalls } = installBrowser('/');
  const destination = 'https://example.naver.com/original';

  analytics.trackBookingClick('home_naver_connect', destination);
  analytics.trackPlaceClick('home_location', destination);
  analytics.trackBlogClick('home_case_modal', destination, 'sample-work');
  analytics.trackReviewClick('home_reviews', destination);

  const events = eventCalls(gtagCalls);
  assert.deepEqual(events.map(({ name }) => name), [
    'booking_click',
    'contact_intent',
    'place_click',
    'blog_click',
    'review_click',
  ]);
  assert.equal(events[0].params.destination, destination);
  assert.equal(events[1].params.contact_method, 'booking');
  assert.equal(events[3].params.work_slug, 'sample-work');
  assert.equal(
    events.filter(({ name }) => name === 'contact_intent').length,
    1,
  );
});

test('admin paths and owner exclusion suppress all analytics and Clarity', () => {
  const admin = installBrowser('/admin');
  analytics.trackTelClick('home_header');
  analytics.trackTalkClick('home_contact', 'https://talk.naver.com/wc55qv');
  assert.equal(admin.gtagCalls.length, 0);
  assert.equal(admin.clarityCalls.length, 0);

  const owner = installBrowser('/', 'foo=1; acedent_owner_excluded=1');
  analytics.trackSmsClick('home_contact');
  analytics.trackPlaceClick('home_location', 'https://m.place.naver.com/place/1');
  assert.equal(owner.gtagCalls.length, 0);
  assert.equal(owner.clarityCalls.length, 0);
});
