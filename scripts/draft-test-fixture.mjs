// Synthetic local data only. No .env, customer records, remote D1/R2 or hook calls.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { loadTs } from './test-support.mjs';

export function draftDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of [
    '0001_admin_content.sql',
    '0003_admin_cleanup_queue.sql',
    '0005_work_secondary_tags.sql',
    '0007_work_og_image_asset.sql',
    '0008_private_work_drafts.sql',
  ])
    db.exec(
      readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
    );
  const binding = {
    prepare(sql) {
      const s = db.prepare(sql);
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return s.get(...args) || null;
        },
        async all() {
          return { results: s.all(...args) };
        },
        async run() {
          const r = s.run(...args);
          return { success: true, meta: { changes: Number(r.changes) } };
        },
      };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = [];
        for (const stmt of statements) results.push(await stmt.run());
        db.exec('COMMIT');
        return results;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { db, binding };
}
export function memoryBucket() {
  const objects = new Map();
  const deleted = [];
  let puts = 0;
  return {
    objects,
    deleted,
    get puts() {
      return puts;
    },
    async put(key, input, options = {}) {
      puts++;
      const bytes = new Uint8Array(await new Response(input).arrayBuffer());
      objects.set(key, {
        key,
        bytes,
        size: bytes.length,
        etag: createHash('md5').update(bytes).digest('hex'),
        uploaded: new Date(),
        ...options,
      });
    },
    async head(key) {
      const o = objects.get(key);
      return o ? { ...o } : null;
    },
    async get(key) {
      const o = objects.get(key);
      return o
        ? {
            ...o,
            body: new ReadableStream({
              start(c) {
                c.enqueue(o.bytes);
                c.close();
              },
            }),
          }
        : null;
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        deleted.push(key);
        objects.delete(key);
      }
    },
    async list() {
      return { objects: [...objects.values()], truncated: false };
    },
  };
}
export function draftFixture() {
  const { db, binding } = draftDatabase();
  const privateR2 = memoryBucket(),
    publicR2 = memoryBucket();
  const env = {
    ACEDENT_DB: binding,
    ACEDENT_IMAGES: publicR2,
    ACEDENT_DRAFT_IMAGES: privateR2,
    R2_PUBLIC_BASE_URL: 'https://images.example.test',
    DEPLOY_HOOK_URL: 'https://hook.example.test',
    CLOUDFLARE_ACCOUNT_ID: 'fixture-account',
    CLOUDFLARE_API_TOKEN: 'local-fixture-not-a-secret',
    CLOUDFLARE_PAGES_PROJECT: 'fixture',
  };
  return { db, env, privateR2, publicR2 };
}
export const emptyPayload = () =>
  loadTs('functions/_shared/work-drafts.ts').normalizeDraft({}, randomUUID());
export function completePayload() {
  return {
    ...emptyPayload(),
    date: '2026-10-17',
    carMaker: '현대',
    carModel: '합성 테스트',
    color: '회색',
    category: 'panel-paint',
    days: '1일',
    title: '로컬 합성 도어 사례',
    summary: '실제 고객 자료가 아닌 검증용 요약입니다.',
    body: '합성 fixture의 설명입니다. 운영에 발행하지 않습니다.',
    parts: [
      {
        part: ['도어'],
        detail: '측면',
        note: '합성 사진 설명',
        beforeAnnotations: [],
        gallery: [],
        comparisons: [],
      },
    ],
  };
}
export function jpegHeader(width, height) {
  return new Uint8Array([
    255,
    216,
    255,
    192,
    0,
    11,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    1,
    1,
    17,
    0,
    255,
    217,
  ]);
}
export async function seedDraft(
  f,
  { id = randomUUID(), complete = false, state = 'writing', imageBytes } = {},
) {
  const p = complete ? completePayload() : emptyPayload();
  const stamp = new Date().toISOString();
  f.db
    .prepare(
      'INSERT INTO work_drafts(id,state,version,payload_json,created_by_email,created_at,updated_at) VALUES(?,?,1,?,?,?,?)',
    )
    .run(id, state, JSON.stringify(p), 'fixture@example.test', stamp, stamp);
  if (complete)
    for (const [kind, width, height] of [
      ['before', 1600, 1200],
      ['after', 1600, 1200],
      ['thumbnail', 800, 600],
      ['og-image', 1200, 630],
    ]) {
      const key = `works/${id}/${randomUUID()}-${kind}.jpg`;
      const bytes = imageBytes?.(kind) || jpegHeader(width, height);
      await f.privateR2.put(key, bytes, {
        customMetadata: {
          kind,
          width: String(width),
          height: String(height),
          bytes: String(bytes.length),
        },
      });
      f.db
        .prepare(
          'INSERT INTO work_draft_assets(object_key,draft_id,kind,part_index,width,height,bytes,ready,created_at) VALUES(?,?,?,?,?,?,?,1,?)',
        )
        .run(
          key,
          id,
          kind,
          kind === 'og-image' ? 20 : 0,
          width,
          height,
          bytes.length,
          stamp,
        );
      if (kind === 'og-image') p.ogImage = { key };
      else p.parts[0][kind] = { key };
    }
  f.db
    .prepare('UPDATE work_drafts SET payload_json=? WHERE id=?')
    .run(JSON.stringify(p), id);
  return { id, payload: p };
}
