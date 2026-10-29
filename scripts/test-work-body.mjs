import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { randomUUID } from 'node:crypto';
import { loadTs } from './test-support.mjs';
import { draftFixture, completePayload } from './draft-test-fixture.mjs';
import { accessFixture } from './access-test-fixture.mjs';

const body = loadTs('lib/work-body.ts');
const WorkBody = loadTs('components/WorkBodyContent.tsx').default;
const Description = loadTs('components/WorkDescription.tsx').default;
const { getWorkDetailStaticHtml } = loadTs('lib/static-html.ts');
const works = JSON.parse(readFileSync(new URL('../content/works.generated.json', import.meta.url), 'utf8')).records.map(({ work }) => work);
const rich = body.WORK_BODY_PREFIX + JSON.stringify([
  ['h', ['확인한 손상']], ['p', ['도어의 ', ['b', '찌그러짐'], '을 확인했습니다.\n추가 줄입니다.']],
  ['ul', [[['p', ['입력한 첫 작업']]], [['p', [['b', '두 번째 작업']]], ['ul', [[['p', ['하위 항목']]]]]]]],
]);

test('every legacy body remains literal and unchanged in public/admin/static rendering', () => {
  for (const w of works) {
    assert.equal(body.parseWorkBody(w.body), null, w.slug);
    assert.equal(body.workBodyText(w.body), w.body);
    const html = renderToStaticMarkup(createElement(WorkBody, { body: w.body }));
    assert.equal(html.replaceAll('&#x27;', "'"), body.renderWorkBodyHtml(w.body), w.slug);
    assert(getWorkDetailStaticHtml(w, [], 0, works).includes(body.renderWorkBodyHtml(w.body)), w.slug);
  }
  const literal = '# 소제목 아님\n\n**문자 그대로** <script>alert(1)</script>';
  assert(!body.renderWorkBodyHtml(literal).includes('<script>'));
  assert(body.renderWorkBodyHtml(literal).includes('**문자 그대로**'));
});

test('heading/bold/list/hard-break round trip is lossless; React and static HTML agree', () => {
  assert.equal(body.editorDocToWorkBody(body.workBodyToEditorDoc(rich)), rich);
  assert.equal(renderToStaticMarkup(createElement(WorkBody, { body: rich })), body.renderWorkBodyHtml(rich));
  const w = { ...works[0], summary: '일반 요약 원문', body: rich };
  assert(getWorkDetailStaticHtml(w, [], 0, works).includes(body.renderWorkBodyHtml(rich)));
  const preview = renderToStaticMarkup(createElement(Description, w));
  assert(preview.includes('<p class="work-detail-summary">일반 요약 원문</p>'));
  assert(preview.includes(body.renderWorkBodyHtml(rich)));
});

test('allowlist escapes hostile text and never interprets legacy/unsupported markup', () => {
  for (const text of ['<img src=x onerror=alert(1)>', '</p><script>alert(1)</script>', '"\'&<iframe>']) {
    const value = body.WORK_BODY_PREFIX + JSON.stringify([['h', [text]], ['p', [['b', text]]]]);
    assert.equal(body.renderWorkBodyHtml(value), renderToStaticMarkup(createElement(WorkBody, { body: value })));
    assert(!body.renderWorkBodyHtml(value).includes('<script>'));
    assert(!body.renderWorkBodyHtml(value).includes('<img'));
  }
  for (const value of [body.WORK_BODY_PREFIX + '{bad', body.WORK_BODY_PREFIX + '[["script",["alert(1)"]]]']) {
    assert.equal(body.parseWorkBody(value), null);
    assert.throws(() => body.validateWorkBody(value), /서식/);
  }
  assert(body.workBodyText(body.editorDocToWorkBody(body.plainTextToEditorDoc(rich))).includes('acedent-body:v1'));
});

test('empty and oversized rich bodies cannot bypass published/draft limits', () => {
  const empty = body.WORK_BODY_PREFIX + '[["h",[" "]]]';
  assert.equal(body.editorDocToWorkBody(body.workBodyToEditorDoc(empty)), '');
  assert.throws(() => body.validateWorkBody(empty, true), /입력/);
  assert.equal(body.validateWorkBody('', false), '');
  assert.throws(() => body.validateWorkBody('가'.repeat(5001)), /5,000/);
});

test('actual local draft PUT/GET/edit preserves body, summary, PART notes and optimistic versioning', async (t) => {
  const f = draftFixture(); t.after(() => f.db.close());
  const access = await accessFixture(t); Object.assign(f.env, access.env);
  const api = loadTs('functions/admin/api/drafts/[id].ts');
  const id = randomUUID();
  const payload = { ...completePayload(), body: rich };
  async function call(method, input) {
    const request = new Request(`https://www.acedentshop.co.kr/admin/api/drafts/${id}`, {
      method, headers: { 'Cf-Access-Jwt-Assertion': await access.token(), 'Content-Type': 'application/json', Origin: 'https://www.acedentshop.co.kr' },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    return api[method === 'PUT' ? 'onRequestPut' : 'onRequestGet']({ request, env: f.env, params: { id } });
  }
  const saved = await call('PUT', { version: 0, state: 'writing', payload });
  assert.equal(saved.status, 200, await saved.clone().text());
  const record = await (await call('GET')).json();
  assert.equal(record.payload.body, rich);
  assert.equal(record.payload.summary, payload.summary);
  assert.deepEqual(record.payload.parts, payload.parts);
  const edited = await call('PUT', { version: record.version, state: 'review', payload: { ...payload, body: rich.replace('확인한 손상', '수정한 소제목') } });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).payload.body, rich.replace('확인한 손상', '수정한 소제목'));
  const invalid = await call('PUT', { version: 2, state: 'writing', payload: { ...payload, body: body.WORK_BODY_PREFIX + '{bad' } });
  assert.equal(invalid.status, 400);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM works').get().n, 0);
  assert.equal(f.privateR2.puts, 0); assert.equal(f.publicR2.puts, 0);
});
