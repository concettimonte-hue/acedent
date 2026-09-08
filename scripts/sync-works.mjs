import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const worksDirectory = resolve(projectDirectory, 'content', 'works');
const outputPath = resolve(projectDirectory, 'content', 'works.generated.json');

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
  for (const key of ['slug', 'date', 'title', 'category', 'carMaker', 'carModel', 'summary', 'body', 'days']) {
    if (typeof work[key] !== 'string' || !work[key].trim()) throw new Error(`${sourceFile}: ${key} 값이 비어 있습니다.`);
  }
  if (!Array.isArray(work.part) || work.part.length === 0) throw new Error(`${sourceFile}: part 배열이 비어 있습니다.`);
  if (!Array.isArray(work.parts) || work.parts.length === 0) throw new Error(`${sourceFile}: parts 배열이 비어 있습니다.`);
  for (const [index, part] of work.parts.entries()) {
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

async function d1Records() {
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
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
    const work = validateWork(JSON.parse(row.payload_json), `d1:${row.slug}`);
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
