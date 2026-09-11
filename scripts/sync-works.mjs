import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const worksDirectory = resolve(projectDirectory, 'content', 'works');
const outputPath = resolve(projectDirectory, 'content', 'works.generated.json');
const legacyR2PublicBases = [
  'https://pub-e6a8f147577c403f93d85e03a6361345.r2.dev',
];
const workCategories = new Set(['dent', 'panel-paint', 'partial-paint', 'replace-paint', 'polish']);

if (existsSync(resolve(projectDirectory, '.env.local'))) {
  process.loadEnvFile(resolve(projectDirectory, '.env.local'));
}

function gitDate(sourceFile, fallback) {
  try {
    const value = execFileSync(
      'git',
      ['log', '-1', '--format=%cs', '--', sourceFile],
      { cwd: projectDirectory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function validateWork(work, sourceFile) {
  if (!work || typeof work !== 'object') throw new Error(`${sourceFile}: 사례 데이터가 객체가 아닙니다.`);
  for (const key of ['slug', 'date', 'title', 'category', 'carMaker', 'summary', 'body', 'days']) {
    if (typeof work[key] !== 'string' || !work[key].trim()) throw new Error(`${sourceFile}: ${key} 값이 비어 있습니다.`);
  }
  if (work.carModel === undefined || work.carModel === null) work.carModel = '';
  if (typeof work.carModel !== 'string') throw new Error(`${sourceFile}: carModel 값이 올바르지 않습니다.`);
  if (!Array.isArray(work.part) || work.part.length === 0) throw new Error(`${sourceFile}: part 배열이 비어 있습니다.`);
  if (work.subCategories === undefined) work.subCategories = [];
  if (!Array.isArray(work.subCategories) || work.subCategories.length > 2) {
    throw new Error(`${sourceFile}: subCategories는 최대 2개의 배열이어야 합니다.`);
  }
  work.subCategories = [...new Set(work.subCategories)];
  if (work.subCategories.some((category) => !workCategories.has(category) || category === work.category)) {
    throw new Error(`${sourceFile}: subCategories에 허용되지 않거나 주 카테고리와 같은 값이 있습니다.`);
  }
  if (work.subParts === undefined) work.subParts = [];
  if (!Array.isArray(work.subParts) || work.subParts.length > 2) {
    throw new Error(`${sourceFile}: subParts는 최대 2개의 배열이어야 합니다.`);
  }
  work.subParts = [...new Set(work.subParts)];
  if (work.subParts.some((part) => typeof part !== 'string' || !part.trim() || part === work.part[0])) {
    throw new Error(`${sourceFile}: subParts에 올바르지 않거나 주 부위와 같은 값이 있습니다.`);
  }
  if (!Array.isArray(work.parts) || work.parts.length === 0) throw new Error(`${sourceFile}: parts 배열이 비어 있습니다.`);
  for (const [index, part] of work.parts.entries()) {
    if (part.part !== undefined) {
      if (!Array.isArray(part.part) || part.part.length === 0 || part.part.length > 3) {
        throw new Error(`${sourceFile}: parts[${index}].part는 1개 이상 3개 이하의 배열이어야 합니다.`);
      }
      part.part = [...new Set(part.part)];
      if (part.part.some((value) => typeof value !== 'string' || !value.trim())) {
        throw new Error(`${sourceFile}: parts[${index}].part 값이 올바르지 않습니다.`);
      }
    }
    for (const key of ['label', 'before', 'after', 'note']) {
      if (typeof part[key] !== 'string' || !part[key].trim()) throw new Error(`${sourceFile}: parts[${index}].${key} 값이 비어 있습니다.`);
    }
  }
  return work;
}

function localRecords() {
  return readdirSync(worksDirectory)
    .filter((fileName) => /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/.test(fileName))
    .sort()
    .map((fileName) => {
      const sourceFile = `content/works/${fileName}`;
      const work = validateWork(
        JSON.parse(readFileSync(resolve(worksDirectory, fileName), 'utf8')),
        sourceFile,
      );
      return { sourceFile, lastModified: gitDate(sourceFile, work.date), work };
    });
}

function wranglerDatabaseId() {
  const configPath = resolve(projectDirectory, 'wrangler.jsonc');
  if (!existsSync(configPath)) return undefined;

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const databaseId = config?.d1_databases?.[0]?.database_id;
    return typeof databaseId === 'string' && databaseId.trim() ? databaseId.trim() : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    throw new Error(`wrangler.jsonc의 D1 설정을 읽지 못했습니다: ${message}`);
  }
}

function wranglerPublicBase() {
  const configPath = resolve(projectDirectory, 'wrangler.jsonc');
  if (!existsSync(configPath)) return undefined;

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const publicBase = config?.vars?.R2_PUBLIC_BASE_URL;
    return typeof publicBase === 'string' && publicBase.trim()
      ? publicBase.trim().replace(/\/+$/, '')
      : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    throw new Error(`wrangler.jsonc의 R2 공개 주소를 읽지 못했습니다: ${message}`);
  }
}

function normalizeR2Url(value, publicBase) {
  if (typeof value !== 'string' || !publicBase) return value;
  const legacyBase = legacyR2PublicBases.find((base) => value === base || value.startsWith(`${base}/`));
  return legacyBase ? `${publicBase}${value.slice(legacyBase.length)}` : value;
}

function normalizeWorkImageUrls(work) {
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '') || wranglerPublicBase();
  if (!publicBase) return work;

  return {
    ...work,
    parts: work.parts.map((part) => ({
      ...part,
      before: normalizeR2Url(part.before, publicBase),
      after: normalizeR2Url(part.after, publicBase),
      thumbnail: normalizeR2Url(part.thumbnail, publicBase),
    })),
  };
}

async function d1Records() {
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim() || wranglerDatabaseId();
  if (!databaseId) return null;

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    throw new Error('D1 빌드에는 CLOUDFLARE_ACCOUNT_ID와 CLOUDFLARE_API_TOKEN이 필요합니다.');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: "SELECT slug, payload_json, updated_at FROM works WHERE status = 'published' ORDER BY date DESC, slug ASC",
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`D1 사례 동기화 실패: HTTP ${response.status}`);

  const rows = payload.result?.flatMap((result) => result.results ?? []) ?? [];
  if (rows.length === 0) throw new Error('D1에 공개 사례가 없습니다. 기존 9건을 먼저 마이그레이션하세요.');

  return rows.map((row) => {
    const work = normalizeWorkImageUrls(
      validateWork(JSON.parse(row.payload_json), `d1:${row.slug}`),
    );
    const updatedAt = typeof row.updated_at === 'string' ? row.updated_at.slice(0, 10) : work.date;
    return { sourceFile: `d1:${row.slug}`, lastModified: updatedAt, work };
  });
}

const records = (await d1Records()) ?? localRecords();
const duplicate = records.find(
  (record, index) => records.findIndex((item) => item.work.slug === record.work.slug) !== index,
);
if (duplicate) throw new Error(`중복된 slug: ${duplicate.work.slug}`);

writeFileSync(outputPath, `${JSON.stringify({ records }, null, 2)}\n`, 'utf8');
console.log(`수리사례 ${records.length}건 동기화 완료 (${records[0]?.sourceFile.startsWith('d1:') ? 'D1' : 'JSON'})`);
