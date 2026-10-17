import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadTs } from './test-support.mjs';
import { accessFixture } from './access-test-fixture.mjs';
import {
  draftFixture,
  emptyPayload,
  seedDraft,
  jpegHeader,
} from './draft-test-fixture.mjs';
const draft = loadTs('functions/admin/api/drafts/[id].ts'),
  assets = loadTs('functions/admin/api/drafts/[id]/assets.ts'),
  list = loadTs('functions/admin/api/drafts.ts'),
  publication = loadTs('functions/admin/api/drafts/[id]/publish.ts');

async function fixture(t) {
  const f = draftFixture();
  t.after(() => f.db.close());
  const access = await accessFixture(t);
  Object.assign(f.env, access.env);
  const original = globalThis.fetch;
  f.hooks = 0;
  f.hookMode = 'success';
  f.buildStatus = 'active';
  f.live = false;
  f.deploymentId = '12345678-abcd-abcd-abcd-123456789012';
  globalThis.fetch = async (url, options) => {
    const address =
      url instanceof Request ? url.url : url instanceof URL ? url.href : url;
    if (url === f.env.DEPLOY_HOOK_URL) {
      f.hooks++;
      if (f.hookMode === 'unknown') throw new Error('local timeout');
      return Response.json({ result: { id: f.deploymentId } });
    }
    if (address.startsWith('https://api.cloudflare.com/')) {
      const deployment = {
        id: f.deploymentId,
        created_on: new Date().toISOString(),
        environment: 'production',
        deployment_trigger: { metadata: { branch: 'main' } },
        latest_stage: { status: f.buildStatus },
      };
      return Response.json({
        success: true,
        result: address.includes('/deployments/')
          ? deployment
          : {
              canonical_deployment: {
                ...deployment,
                id: f.currentDeploymentId || deployment.id,
              },
            },
      });
    }
    if (address.startsWith('https://www.acedentshop.co.kr/')) {
      const work = f.db
        .prepare("SELECT payload_json FROM works WHERE status='published'")
        .get();
      const p = work ? JSON.parse(work.payload_json) : null;
      return new Response(
        f.live && p
          ? `<link rel="canonical" href="https://www.acedentshop.co.kr/works/detail/${p.slug}"><img src="${p.parts[0].after}"><loc>https://www.acedentshop.co.kr/works/detail/${p.slug}</loc>`
          : 'not found',
        { status: f.live ? 200 : 404 },
      );
    }
    return original(url, options);
  };
  f.call = async (
    handler,
    id = '',
    method = 'GET',
    body,
    auth = true,
    options = {},
  ) => {
    const headers = {
      Origin: options.origin || 'https://www.acedentshop.co.kr',
    };
    if (auth) headers['Cf-Access-Jwt-Assertion'] = await access.token();
    if (body && !(body instanceof FormData))
      headers['Content-Type'] = 'application/json';
    return handler({
      env: f.env,
      params: id ? { id } : {},
      request: new Request(
        `https://www.acedentshop.co.kr/admin/api/drafts/${id}${options.query || ''}`,
        {
          method,
          headers,
          ...(method === 'GET'
            ? {}
            : {
                body:
                  body instanceof FormData
                    ? body
                    : body
                      ? JSON.stringify(body)
                      : undefined,
              }),
        },
      ),
    });
  };
  return f;
}

await test('private draft roundtrip accepts missing fields/pairs, does not touch works/public R2/hook; review edits and version conflicts', async (t) => {
  const f = await fixture(t);
  const id = randomUUID();
  const p = {
    ...emptyPayload(),
    title: '미완성 초안 비밀',
    parts: [
      {
        part: ['도어'],
        category: undefined,
        detail: '조수석',
        note: '',
        beforeAnnotations: [
          { type: 'circle', x: 0.3, y: 0.4, width: 0.15, height: 0.2 },
        ],
        gallery: [{ caption: '사진을 나중에 추가할 설명' }],
        comparisons: [
          {
            caption: '설'.repeat(120),
            beforeAnnotations: [
              { type: 'arrow', startX: 0.1, startY: 0.3, endX: 0.4, endY: 0.5 },
            ],
          },
        ],
      },
    ],
  };
  let r = await f.call(draft.onRequestPut, id, 'PUT', {
    version: 0,
    state: 'writing',
    payload: p,
  });
  assert.equal(r.status, 200);
  const saved = await r.json();
  assert(saved.missing.length > 0);
  r = await f.call(draft.onRequestGet, id);
  assert.deepEqual((await r.json()).payload, JSON.parse(JSON.stringify(p)));
  r = await f.call(draft.onRequestPut, id, 'PUT', {
    version: 1,
    state: 'review',
    payload: p,
  });
  assert.equal(r.status, 200);
  r = await f.call(draft.onRequestPut, id, 'PUT', {
    version: 1,
    state: 'writing',
    payload: p,
  });
  assert.equal(r.status, 409);
  r = await f.call(draft.onRequestPut, id, 'PUT', {
    version: 2,
    state: 'writing',
    payload: { ...p, title: '검토 후 수정' },
  });
  assert.equal((await r.json()).state, 'writing');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM works').get().n, 0);
  assert.equal(f.publicR2.puts, 0);
  assert.equal(f.hooks, 0);
  const all = await (await f.call(list.onRequestGet)).json();
  assert.equal(all.drafts.length, 1);
});

await test('Access and same-origin enforcement, missing private binding fail closed; no public photo URL fallback', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f, { complete: true });
  for (const fn of [
    draft.onRequestGet,
    list.onRequestGet,
    assets.onRequestGet,
    publication.onRequestGet,
  ])
    assert.equal((await f.call(fn, id, 'GET', undefined, false)).status, 403);
  assert.equal(
    (
      await f.call(
        draft.onRequestPut,
        id,
        'PUT',
        { version: 1, state: 'writing', payload: emptyPayload() },
        true,
        { origin: 'https://untrusted.example' },
      )
    ).status,
    403,
  );
  const missing = { ...f.env, ACEDENT_DRAFT_IMAGES: undefined };
  f.env = missing;
  assert.equal((await f.call(draft.onRequestGet, id)).status, 503);
  f.env.ACEDENT_DRAFT_IMAGES = f.publicR2;
  assert.equal((await f.call(draft.onRequestGet, id)).status, 503);
});

await test('incomplete before upload is private, ready and reopenable; cross-draft references rejected', async (t) => {
  const f = await fixture(t);
  const { id, payload: p } = await seedDraft(f);
  const body = new FormData();
  body.set(
    'file',
    new File([jpegHeader(1600, 1200)], 'sample.jpg', { type: 'image/jpeg' }),
  );
  body.set('kind', 'before');
  body.set('partIndex', '0');
  body.set('assetId', randomUUID());
  const r = await f.call(assets.onRequestPost, id, 'POST', body);
  assert.equal(r.status, 201);
  const image = await r.json();
  assert(image.url.startsWith('/admin/api/drafts/'));
  assert.equal(f.publicR2.puts, 0);
  p.parts = [
    {
      part: ['도어'],
      detail: '',
      note: '',
      before: { key: image.key },
      beforeAnnotations: [],
      gallery: [],
      comparisons: [],
    },
  ];
  assert.equal(
    (
      await f.call(draft.onRequestPut, id, 'PUT', {
        version: 1,
        state: 'writing',
        payload: p,
      })
    ).status,
    200,
  );
  const other = await seedDraft(f);
  assert.equal(
    (
      await f.call(draft.onRequestPut, other.id, 'PUT', {
        version: 1,
        state: 'writing',
        payload: p,
      })
    ).status,
    400,
  );
  assert.equal(
    (await f.call(assets.onRequestPost, id, 'POST', body)).status,
    200,
  );
  assert.equal(f.privateR2.puts, 1);
  const photo = await f.call(assets.onRequestGet, id, 'GET', undefined, true, {
    query: `?key=${encodeURIComponent(image.key)}`,
  });
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(
    photo.headers.get('Cross-Origin-Resource-Policy'),
    'same-origin',
  );
  assert.equal(
    (await photo.arrayBuffer()).byteLength,
    jpegHeader(1600, 1200).length,
  );
  assert.equal(
    (
      await f.call(assets.onRequestGet, other.id, 'GET', undefined, true, {
        query: `?key=${encodeURIComponent(image.key)}`,
      })
    ).status,
    404,
  );
});

await test('manual publication freezes reviewed version; repeated/concurrent requests create one work and one hook', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f, { complete: true, state: 'review' });
  const body = { version: 1, confirmed: true };
  const responses = await Promise.all([
    f.call(publication.onRequestPost, id, 'POST', body),
    f.call(publication.onRequestPost, id, 'POST', body),
  ]);
  assert(responses.some((r) => r.status === 202));
  assert(responses.every((r) => [202, 409].includes(r.status)));
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM works').get().n, 1);
  assert.equal(f.hooks, 1);
  assert.equal(f.publicR2.objects.size, 4);
  assert.equal(
    (await f.call(publication.onRequestPost, id, 'POST', body)).status,
    202,
  );
  assert.equal(f.hooks, 1);
  assert.equal(
    (
      await f.call(draft.onRequestPut, id, 'PUT', {
        version: 1,
        state: 'writing',
        payload: emptyPayload(),
      })
    ).status,
    409,
  );
  f.buildStatus = 'success';
  let r = await f.call(publication.onRequestGet, id);
  assert.equal((await r.json()).deploy_state, 'verifying');
  f.live = true;
  f.currentDeploymentId = '87654321-abcd-abcd-abcd-123456789012';
  r = await f.call(publication.onRequestGet, id);
  assert.equal((await r.json()).deploy_state, 'ready');
});

await test('numeric slug collisions, expired publication lease and invalid action do not overwrite cases', async (t) => {
  const f = await fixture(t);
  const a = await seedDraft(f, { complete: true, state: 'review' });
  const b = await seedDraft(f, { complete: true, state: 'review' });
  assert.equal(
    (
      await f.call(publication.onRequestPost, a.id, 'POST', {
        version: 1,
        confirmed: true,
        action: 'wrong',
      })
    ).status,
    400,
  );
  f.db
    .prepare(
      "UPDATE work_drafts SET lease_token='expired',lease_until='2000-01-01T00:00:00.000Z' WHERE id=?",
    )
    .run(a.id);
  assert.equal(
    (
      await f.call(publication.onRequestPost, a.id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    202,
  );
  assert.equal(
    (
      await f.call(publication.onRequestPost, b.id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    202,
  );
  const first = f.db
    .prepare('SELECT published_slug slug FROM work_drafts WHERE id=?')
    .get(a.id).slug;
  const second = f.db
    .prepare('SELECT published_slug slug FROM work_drafts WHERE id=?')
    .get(b.id).slug;
  assert(typeof first === 'string');
  assert.equal(second, `${first}-2`);
  assert.equal(f.db.prepare('SELECT count(*) n FROM works').get().n, 2);
  const c = await seedDraft(f, { complete: true, state: 'review' });
  const d = await seedDraft(f, { complete: true, state: 'review' });
  const copy = f.publicR2.put.bind(f.publicR2);
  f.publicR2.put = async () => {
    throw new Error('hold reserved slug');
  };
  assert.equal(
    (
      await f.call(publication.onRequestPost, c.id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    503,
  );
  f.publicR2.put = copy;
  assert.equal(
    (
      await f.call(publication.onRequestPost, d.id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    202,
  );
  assert.equal(
    f.db
      .prepare('SELECT published_slug slug FROM work_drafts WHERE id=?')
      .get(d.id).slug,
    `${first}-4`,
  );
});

await test('upload failure is retryable; uncertain in-flight uploads block deletion instead of deleting public data', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f);
  const body = new FormData();
  body.set(
    'file',
    new File([jpegHeader(1600, 1200)], 'synthetic.jpg', { type: 'image/jpeg' }),
  );
  body.set('kind', 'before');
  body.set('partIndex', '0');
  body.set('assetId', randomUUID());
  const put = f.privateR2.put.bind(f.privateR2);
  f.privateR2.put = async () => {
    throw new Error('local upload failure');
  };
  assert.equal(
    (await f.call(assets.onRequestPost, id, 'POST', body)).status,
    503,
  );
  f.privateR2.put = put;
  assert.equal(
    (await f.call(assets.onRequestPost, id, 'POST', body)).status,
    201,
  );
  f.db.prepare('UPDATE work_draft_assets SET ready=0 WHERE draft_id=?').run(id);
  assert.equal(
    (await f.call(draft.onRequestDelete, id, 'DELETE', { version: 1 })).status,
    409,
  );
  assert.equal(f.privateR2.objects.size, 1);
  assert.equal(f.publicR2.deleted.length, 0);
});

await test('copy failure retains private snapshot; retry resumes same slug and public keys, orphan cleaner protects promotion', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f, { complete: true, state: 'review' });
  const put = f.publicR2.put.bind(f.publicR2);
  let n = 0;
  f.publicR2.put = async (...args) => {
    if (++n === 2) throw new Error('local copy failure');
    return put(...args);
  };
  assert.equal(
    (
      await f.call(publication.onRequestPost, id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    503,
  );
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM works').get().n, 0);
  assert.equal(f.privateR2.objects.size, 4);
  const row = f.db.prepare('SELECT * FROM work_drafts WHERE id=?').get(id);
  assert.equal(row.state, 'publishing');
  assert(row.publish_json);
  const orphan = loadTs('functions/admin/api/orphans.ts');
  const result = await (await f.call(orphan.onRequestGet)).json();
  assert.equal(result.orphanCount, 0);
  const keys = [...f.publicR2.objects.keys()];
  assert.equal(
    (await f.call(orphan.onRequestDelete, '', 'DELETE', { keys })).status,
    409,
  );
  f.publicR2.put = put;
  assert.equal(
    (
      await f.call(publication.onRequestPost, id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    202,
  );
  assert.equal(
    f.db.prepare('SELECT slug FROM works').get().slug,
    row.published_slug,
  );
  assert.equal(f.publicR2.objects.size, 4);
});

await test('unknown hook never auto-repeats; explicit known failed build retries deployment only', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f, { complete: true, state: 'review' });
  f.hookMode = 'unknown';
  let r = await f.call(publication.onRequestPost, id, 'POST', {
    version: 1,
    confirmed: true,
  });
  assert.equal((await r.json()).deploy_state, 'unknown');
  await f.call(publication.onRequestPost, id, 'POST', {
    version: 1,
    confirmed: true,
  });
  await f.call(publication.onRequestPost, id, 'POST', {
    version: 1,
    confirmed: true,
    action: 'retry-deploy',
  });
  assert.equal(f.hooks, 1);
  await f.call(publication.onRequestPost, id, 'POST', {
    version: 1,
    confirmed: true,
    action: 'attach',
    deploymentId: f.deploymentId,
  });
  f.buildStatus = 'failure';
  r = await f.call(publication.onRequestGet, id);
  assert.equal((await r.json()).deploy_state, 'failed');
  f.hookMode = 'success';
  await f.call(publication.onRequestPost, id, 'POST', {
    version: 1,
    confirmed: true,
    action: 'retry-deploy',
  });
  assert.equal(f.hooks, 2);
  assert.equal(f.publicR2.puts, 4);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM works').get().n, 1);
});

await test('private delete affects only requested draft; published/locked/version-changed drafts protected', async (t) => {
  const f = await fixture(t);
  const a = await seedDraft(f, { complete: true });
  const b = await seedDraft(f, { complete: true });
  assert.equal(
    (await f.call(draft.onRequestDelete, a.id, 'DELETE', { version: 2 }))
      .status,
    409,
  );
  assert.equal(
    (await f.call(draft.onRequestDelete, a.id, 'DELETE', { version: 1 }))
      .status,
    200,
  );
  assert.equal(f.privateR2.objects.size, 4);
  assert.equal(f.publicR2.deleted.length, 0);
  assert(f.db.prepare('SELECT id FROM work_drafts WHERE id=?').get(b.id));
  f.db
    .prepare("UPDATE work_drafts SET lease_token='active' WHERE id=?")
    .run(b.id);
  assert.equal(
    (
      await f.call(draft.onRequestPut, b.id, 'PUT', {
        version: 1,
        state: 'writing',
        payload: b.payload,
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.call(draft.onRequestDelete, b.id, 'DELETE', { version: 1 }))
      .status,
    409,
  );
});

await test('stale reviewed version and incomplete draft cannot publish; public sync reads only published works', async (t) => {
  const f = await fixture(t);
  const { id } = await seedDraft(f, { state: 'review' });
  assert.equal(
    (
      await f.call(publication.onRequestPost, id, 'POST', {
        version: 2,
        confirmed: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call(publication.onRequestPost, id, 'POST', {
        version: 1,
        confirmed: true,
      })
    ).status,
    400,
  );
  assert.equal(f.hooks, 0);
  assert.equal(f.publicR2.puts, 0);
  const sync = readFileSync(
    new URL('./sync-works.mjs', import.meta.url),
    'utf8',
  );
  assert(sync.includes("FROM works WHERE status = 'published'"));
  assert(!sync.includes('work_drafts'));
});
