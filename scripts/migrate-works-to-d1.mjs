import { createHash } from 'node:crypto';
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

function objectUrl(objectKey) {
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `${publicBase}/${encodedKey}`;
}

function apiObjectUrl(objectKey) {
  // Cloudflare R2 REST API는 키의 슬래시는 그대로 두고 각 경로 조각만
  // 인코딩해야 한다. 따라서 한글·공백이 있어도 URL이 깨지지 않는다.
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
  return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets/${encodeURIComponent(bucket)}/objects/${encodedKey}`;
}

function localMd5(localPath) {
  return createHash('md5').update(readFileSync(localPath)).digest('hex');
}

async function remoteAssetMatches(localPath, objectKey) {
  const response = await fetch(objectUrl(objectKey), {
    method: 'HEAD',
    cache: 'no-store',
  });
  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`R2 파일 확인 실패 (${objectKey}): HTTP ${response.status}`);
  }

  const localBytes = statSync(localPath).size;
  const remoteBytes = Number(response.headers.get('content-length'));
  const remoteEtag = response.headers.get('etag')
    ?.replace(/^W\//i, '')
    .replaceAll('"', '')
    .toLowerCase();
  const sameSize = Number.isFinite(remoteBytes) && remoteBytes === localBytes;
  if (!sameSize || !remoteEtag || remoteEtag.includes('-')) return false;
  return remoteEtag === localMd5(localPath);
}

async function uploadAsset(localPath, objectKey) {
  if (!existsSync(localPath)) throw new Error(`로컬 이미지가 없습니다: ${localPath}`);

  console.log(`  [확인] ${objectKey}`);
  if (await remoteAssetMatches(localPath, objectKey)) {
    console.log(`  [건너뜀] ${objectKey}`);
    return objectUrl(objectKey);
  }

  console.log(`  [업로드] ${objectKey}`);
  const bytes = readFileSync(localPath);
  const body = new FormData();
  body.append(
    'body',
    new Blob([bytes], { type: 'image/jpeg' }),
    objectKey.split('/').at(-1),
  );
  const response = await fetch(apiObjectUrl(objectKey), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const message = payload?.errors?.map((error) => error.message).filter(Boolean).join(', ');
    throw new Error(`R2 업로드 실패 (${objectKey}): HTTP ${response.status}${message ? ` - ${message}` : ''}`);
  }
  if (Number(payload.result?.size) !== bytes.byteLength) {
    throw new Error(`R2 업로드 크기 불일치 (${objectKey})`);
  }
  console.log(`  [업로드 완료] ${objectKey}`);
  return objectUrl(objectKey);
}

const table = await query("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'works'");
if (!table?.[0]?.results?.length) {
  throw new Error('D1 스키마가 없습니다. migrations/0001_admin_content.sql을 먼저 적용하세요.');
}

const worksDirectory = resolve(projectDirectory, 'content', 'works');
const files = readdirSync(worksDirectory).filter((name) => name.endsWith('.json')).sort();

for (const [fileIndex, fileName] of files.entries()) {
  console.log(`\n[${fileIndex + 1}/${files.length}] ${fileName}`);
  const work = JSON.parse(readFileSync(resolve(worksDirectory, fileName), 'utf8'));
  const assets = [];
  for (const [partIndex, part] of work.parts.entries()) {
    for (const kind of ['before', 'after']) {
      const source = part[kind];
      if (!source.startsWith('/works/')) continue;
      const objectKey = source.slice(1);
      const localPath = resolve(projectDirectory, 'public', objectKey);
      part[kind] = await uploadAsset(localPath, objectKey);
      assets.push({ objectKey, publicUrl: part[kind], kind, partIndex, width: 1600, height: 1200, bytes: statSync(localPath).size });
    }
    if (partIndex === 0) {
      const originalName = part.after.split('/').at(-1).replace(/-after\.jpg$/i, '.jpg');
      const localPath = resolve(projectDirectory, 'public', 'works', 'thumbnails', originalName);
      if (existsSync(localPath)) {
        const objectKey = `works/thumbnails/${originalName}`;
        part.thumbnail = await uploadAsset(localPath, objectKey);
        assets.push({ objectKey, publicUrl: part.thumbnail, kind: 'thumbnail', partIndex, width: 800, height: 600, bytes: statSync(localPath).size });
      }
    }
  }

  const now = new Date().toISOString();
  await query(
    `INSERT INTO works (slug, date, category, payload_json, status, created_by_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'published', 'migration', ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       date = excluded.date,
       category = excluded.category,
       payload_json = excluded.payload_json,
       status = excluded.status,
       updated_at = excluded.updated_at
     WHERE works.date <> excluded.date
        OR works.category <> excluded.category
        OR works.payload_json <> excluded.payload_json
        OR works.status <> excluded.status`,
    [work.slug, work.date, work.category, JSON.stringify(work), now, now],
  );
  for (const asset of assets) {
    await query(
      `INSERT INTO work_assets
       (object_key, work_slug, public_url, kind, part_index, width, height, bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(object_key) DO UPDATE SET
         work_slug = excluded.work_slug,
         public_url = excluded.public_url,
         kind = excluded.kind,
         part_index = excluded.part_index,
         width = excluded.width,
         height = excluded.height,
         bytes = excluded.bytes,
         created_at = excluded.created_at
       WHERE work_assets.work_slug <> excluded.work_slug
          OR work_assets.public_url <> excluded.public_url
          OR work_assets.kind <> excluded.kind
          OR work_assets.part_index <> excluded.part_index
          OR work_assets.width <> excluded.width
          OR work_assets.height <> excluded.height
          OR work_assets.bytes <> excluded.bytes`,
      [asset.objectKey, work.slug, asset.publicUrl, asset.kind, asset.partIndex, asset.width, asset.height, asset.bytes, now],
    );
  }
  console.log(`  [완료] ${fileName} → ${work.slug}`);
}

console.log(`\n마이그레이션 완료: ${files.length}개 파일`);
