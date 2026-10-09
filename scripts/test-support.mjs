// Test-only TypeScript loader and in-memory D1 fixtures. No credentials/network.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
export function loadTs(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = { exports: {} };
  cache.set(path, loadedModule);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: path }).outputText;
  const require = (specifier) => {
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return nativeRequire(specifier);
    const base = specifier.startsWith('@/') ? resolve(root, specifier.slice(2)) : resolve(dirname(path), specifier);
    if (base.endsWith('.json')) return JSON.parse(readFileSync(base, 'utf8'));
    const target = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
    if (!target) throw new Error(`Missing test dependency: ${specifier}`);
    return loadTs(target);
  };
  // This test-only loader compiles trusted repository modules, never request/user input.
  // oxlint-disable-next-line typescript/no-implied-eval
  new Function('require', 'module', 'exports', code)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

export function fixtureDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE works (slug TEXT PRIMARY KEY, date TEXT, category TEXT, status TEXT, payload_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE site_visit_daily (visitor_hash TEXT, visit_date TEXT, path TEXT, page_views INTEGER);`);
  const { analyticsPeriod } = loadTs('lib/admin-analytics.ts');
  const period = analyticsPeriod(30);
  const insert = db.prepare('INSERT INTO works VALUES (?, ?, ?, ?, ?, ?, ?)');
  const base = JSON.parse(readFileSync(resolve(root, 'content/works.generated.json'), 'utf8')).records[0].work;
  for (let i = 0; i < 50; i++) {
    const work = { ...base, slug: `local-test-${i + 1}`, title: `로컬 테스트 ${i + 1} · 긴 수리사례 제목도 모바일에서 확인`, carMaker: i % 2 ? 'BMW' : '현대', carModel: i % 2 ? '530i' : '쏘나타', category: i % 2 ? 'panel-paint' : 'dent', subCategories: [], part: [i % 2 ? '도어' : '범퍼'], parts: [{ ...base.parts[0], part: [i % 2 ? '도어' : '범퍼'], category: i % 2 ? 'panel-paint' : 'dent' }] };
    const created = i === 49 ? `${period.today}T00:00:00Z` : '2026-08-01T00:00:00Z';
    insert.run(work.slug, work.date, work.category, 'published', JSON.stringify(work), created, created);
  }
  const visit = db.prepare('INSERT INTO site_visit_daily VALUES (?, ?, ?, ?)');
  visit.run('visitor1', period.start, '/works/detail/local-test-1', 2);
  visit.run('visitor1', period.end, '/works/detail/local-test-1', 3);
  visit.run('visitor2', period.end, '/works/detail/local-test-1', 1);
  visit.run('visitor1', period.previousStart, '/works/detail/local-test-1', 4);
  visit.run('visitor3', period.end, '/', 10);
  visit.run('owner-test-today', period.today, '/works/detail/local-test-1', 100);
  const env = { ACEDENT_DB: {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let params = [];
      return { bind(...values) { params = values; return this; }, async all() { return { results: stmt.all(...params) }; }, async first() { return stmt.get(...params) ?? null; } };
    },
  } };
  return { db, env, period };
}

export const localRequest = (path = '/admin/api/analytics?days=30') => new Request(`http://127.0.0.1${path}`, { headers: { 'Cf-Access-Jwt-Assertion': 'local-fixture-only' } });
