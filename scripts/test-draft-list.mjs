import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import { draftListFixture } from './draft-list-fixture.mjs';

const {
  draftListGroup,
  draftListStatus,
  groupDrafts,
  publishedDraftLinks,
  canEditDraft,
  canDeleteDraft,
} = loadTs('lib/draft-list.ts');
const { AdminDraftRow } = loadTs('components/AdminDraftsList.tsx');
const { onRequestGet } = loadTs('functions/admin/api/drafts.ts');
const { draftRecord } = loadTs('functions/_shared/work-drafts.ts');

async function fixture(t) {
  const f = await draftListFixture();
  t.after(() => f.db.close());
  f.records = await Promise.all(
    f.db
      .prepare(`SELECT d.*,w.slug AS published_work_slug FROM work_drafts d
      LEFT JOIN works w ON w.slug=d.published_slug AND w.status='published'
      ORDER BY d.updated_at DESC`)
      .all()
      .map(async (row) => ({
        ...(await draftRecord(f.env, row)),
        published_work_slug: row.published_work_slug,
      })),
  );
  return f;
}
const rowHtml = (draft) =>
  renderToStaticMarkup(
    React.createElement(AdminDraftRow, {
      draft,
      busy: false,
      onRemove: () => {
        throw new Error('Rendering cannot delete');
      },
    }),
  );

await test('only ready is completed; every other deployment phase remains in progress in original order', async (t) => {
  const f = await fixture(t);
  const groups = groupDrafts(f.records);
  assert.equal(groups.progress.length, 10);
  assert.equal(groups.completed.length, 4);
  assert.deepEqual(
    groups.progress.map((d) => d.id),
    f.records.filter((d) => d.deploy_state !== 'ready').map((d) => d.id),
  );
  assert.ok(groups.completed.every((d) => d.deploy_state === 'ready'));
  assert.equal(
    draftListGroup({ state: 'published', deploy_state: 'new-unknown-state' }),
    'progress',
  );
  assert.deepEqual(groupDrafts([]), { progress: [], completed: [] });
  assert.equal(groupDrafts(groups.completed).progress.length, 0);
  assert.equal(groupDrafts(groups.progress).completed.length, 0);
  assert.equal(
    draftListStatus({ state: 'published', deploy_state: 'failed' }),
    '배포 실패 · 확인 필요',
  );
  assert.equal(
    draftListStatus({ state: 'published', deploy_state: 'unknown' }),
    '배포 상태 확인 필요',
  );
});

await test('completed row opens exact live public/edit URLs and labels history without exposing draft edit/delete', async (t) => {
  const f = await fixture(t);
  const d = f.records.find((d) => d.published_slug === 'local-published');
  assert.deepEqual(publishedDraftLinks(d), {
    public: 'https://www.acedentshop.co.kr/works/detail/local-published',
    edit: '/admin?view=edit&slug=local-published',
  });
  const html = rowHtml(d);
  assert.match(
    html,
    /href="https:\/\/www\.acedentshop\.co\.kr\/works\/detail\/local-published" target="_blank" rel="noopener noreferrer"/,
  );
  assert.match(html, /href="\/admin\?view=edit&amp;slug=local-published"/);
  assert.match(html, /발행 당시 원본·기록/);
  assert.doesNotMatch(html, /초안 삭제|이어서 작성|view=draft&amp;/);
  assert.match(html, /발행 당시 제목/);
  assert.doesNotMatch(html, /현재 공개 제목/);
});

await test('missing, deleted, nonpublic, mismatched or invalid links use safe fallback, never guess a slug', async (t) => {
  const f = await fixture(t);
  const completed = f.records.filter((d) => d.deploy_state === 'ready');
  const base = completed[0];
  const invalid = [
    ...completed.filter((d) => d.published_slug !== 'local-published'),
    { ...base, published_work_slug: 'different-case' },
    { ...base, published_work_slug: undefined },
    {
      ...base,
      published_slug: '../../admin',
      published_work_slug: '../../admin',
    },
    {
      ...base,
      published_slug: 'https://external.test',
      published_work_slug: 'https://external.test',
    },
  ];
  for (const d of invalid) {
    assert.equal(publishedDraftLinks(d), null);
    const html = rowHtml(d);
    assert.match(html, /현재 공개 사례와의 연결을 확인할 수 없습니다/);
    assert.match(html, /href="\/admin">공개 사례 관리/);
    assert.doesNotMatch(html, /view=edit|공개 글 보기|초안 삭제|이어서 작성/);
  }
});

await test('pending/failed/unknown retain review recovery route; only existing unpublished states expose deletion', async (t) => {
  const f = await fixture(t);
  for (const d of f.records) {
    const html = rowHtml(d);
    if (d.deploy_state === 'ready') continue;
    assert.match(html, /검토·미리보기/);
    assert.equal(
      html.includes('초안 삭제'),
      ['writing', 'review', 'deleting'].includes(d.state),
    );
    assert.equal(
      html.includes('이어서 작성'),
      ['writing', 'review'].includes(d.state),
    );
    assert.doesNotMatch(html, /view=edit|공개 글 보기/);
    assert.equal(publishedDraftLinks(d), null);
  }
  // Even an inconsistent historical state must not offer completed-record deletion.
  const readyWriting = { ...f.records[0], deploy_state: 'ready' };
  assert.equal(canDeleteDraft(readyWriting), false);
  assert.equal(canEditDraft(readyWriting), false);
  assert.doesNotMatch(rowHtml(readyWriting), /초안 삭제|이어서 작성/);
});

await test('authenticated list API joins live status and reads only; no auth means no records', async (t) => {
  const f = await fixture(t);
  const auth = await accessFixture(t);
  Object.assign(f.env, auth.env);
  const snapshot = () =>
    JSON.stringify({
      drafts: f.db.prepare('SELECT * FROM work_drafts ORDER BY id').all(),
      assets: f.db
        .prepare('SELECT * FROM work_draft_assets ORDER BY object_key')
        .all(),
      works: f.db.prepare('SELECT * FROM works ORDER BY slug').all(),
      privatePuts: f.privateR2.puts,
      privateDeletes: f.privateR2.deleted,
      publicPuts: f.publicR2.puts,
      publicDeletes: f.publicR2.deleted,
    });
  const before = snapshot();
  const response = await onRequestGet({
    env: f.env,
    params: {},
    request: await auth.request('/admin/api/drafts'),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  const { drafts } = await response.json();
  assert.equal(drafts.length, 14);
  assert.equal(
    drafts.find((d) => d.published_slug === 'local-published')
      .published_work_slug,
    'local-published',
  );
  assert.equal(
    drafts.find((d) => d.published_slug === 'local-deleted')
      .published_work_slug,
    null,
  );
  assert.equal(
    drafts.find((d) => d.published_slug === 'local-nonpublic')
      .published_work_slug,
    null,
  );
  assert.deepEqual(
    drafts.map((d) => d.updated_at),
    drafts.map((d) => d.updated_at).sort((a, b) => b.localeCompare(a)),
  );
  const denied = await onRequestGet({
    env: f.env,
    params: {},
    request: new Request('https://www.acedentshop.co.kr/admin/api/drafts'),
  });
  assert.equal(denied.status, 403);
  assert.doesNotMatch(await denied.text(), /발행 당시 제목|local-published/);
  assert.equal(snapshot(), before);
});
