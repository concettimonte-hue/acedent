import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const envPath = resolve(projectDirectory, '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');

for (const [name, value] of Object.entries({ accountId, token, databaseId, bucket, publicBase })) {
  if (!value) throw new Error(`마이그레이션 설정 누락: ${name}`);
}

async function query(sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`D1 요청 실패: HTTP ${response.status}`);
  return payload.result;
}

function uploadAsset(localPath, objectKey) {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(
    executable,
    ['wrangler', 'r2', 'object', 'put', `${bucket}/${objectKey}`, '--file', localPath, '--remote'],
    { cwd: projectDirectory, stdio: 'inherit' },
  );
  return `${publicBase}/${objectKey}`;
}

const table = await query("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'works'");
if (!table?.[0]?.results?.length) {
  throw new Error('D1 스키마가 없습니다. migrations/0001_admin_content.sql을 먼저 적용하세요.');
}

const worksDirectory = resolve(projectDirectory, 'content', 'works');
const files = readdirSync(worksDirectory).filter((name) => name.endsWith('.json')).sort();

for (const fileName of files) {
  const work = JSON.parse(readFileSync(resolve(worksDirectory, fileName), 'utf8'));
  const assets = [];
  for (const [partIndex, part] of work.parts.entries()) {
    for (const kind of ['before', 'after']) {
      const source = part[kind];
      if (!source.startsWith('/works/')) continue;
      const objectKey = source.slice(1);
      const localPath = resolve(projectDirectory, 'public', objectKey);
      part[kind] = uploadAsset(localPath, objectKey);
      assets.push({ objectKey, publicUrl: part[kind], kind, partIndex, width: 1600, height: 1200, bytes: statSync(localPath).size });
    }
    if (partIndex === 0) {
      const originalName = part.after.split('/').at(-1).replace(/-after\.jpg$/i, '.jpg');
      const localPath = resolve(projectDirectory, 'public', 'works', 'thumbnails', originalName);
      if (existsSync(localPath)) {
        const objectKey = `works/thumbnails/${originalName}`;
        part.thumbnail = uploadAsset(localPath, objectKey);
        assets.push({ objectKey, publicUrl: part.thumbnail, kind: 'thumbnail', partIndex, width: 800, height: 600, bytes: statSync(localPath).size });
      }
    }
  }

  const now = new Date().toISOString();
  await query(
    `INSERT INTO works (slug, date, category, payload_json, status, created_by_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'published', 'migration', ?, ?)
     ON CONFLICT(slug) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
    [work.slug, work.date, work.category, JSON.stringify(work), now, now],
  );
  for (const asset of assets) {
    await query(
      `INSERT OR REPLACE INTO work_assets
       (object_key, work_slug, public_url, kind, part_index, width, height, bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset.objectKey, work.slug, asset.publicUrl, asset.kind, asset.partIndex, asset.width, asset.height, asset.bytes, now],
    );
  }
  console.log(`${work.slug} 마이그레이션 완료`);
}
