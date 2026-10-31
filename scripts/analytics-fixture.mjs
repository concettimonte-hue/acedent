// Local synthetic records only. Never reads credentials or production data.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { loadTs } from './test-support.mjs';

export function analyticsFixture({ now = new Date(), seed = true, acquisition = true, evidence = true } = {}) {
  const { analyticsDate, shiftAnalyticsDate } = loadTs('lib/admin-analytics.ts');
  const today = analyticsDate(now);
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0007_private_visit_analytics.sql', import.meta.url), 'utf8'));
  if (acquisition) db.exec(readFileSync(new URL('../migrations/0009_visit_acquisition.sql', import.meta.url), 'utf8'));
  if (acquisition && evidence) db.exec(readFileSync(new URL('../migrations/0010_visit_source_basis.sql', import.meta.url), 'utf8'));
  db.exec('CREATE TABLE works (slug TEXT PRIMARY KEY, status TEXT, payload_json TEXT, created_at TEXT)');
  const cases = [
    ['sample-door', '현대', '쏘나타', '뒤도어 찌그러짐 판금도색'],
    ['sample-bumper', '기아', '스포티지', '앞범퍼 긁힘 부분도색'],
    ['sample-dent', 'BMW', '530i', '도어 문콕 덴트 복원'],
    ['sample-trunk', '볼보', 'XC40', '트렁크 찌그러짐 복원'],
    ['sample-fender', '메르세데스-벤츠', 'CLS450', '휀더 손상 판금도색'],
    ['sample-new', '렉서스', 'UX250h', '후도어 손상 수리'],
  ];
  const insertWork = db.prepare('INSERT INTO works VALUES (?, ?, ?, ?)');
  for (const [slug, carMaker, carModel, title] of cases) {
    insertWork.run(slug, 'published', JSON.stringify({ carMaker, carModel, title: `[예시] ${title}` }), `${shiftAnalyticsDate(today, slug === 'sample-new' ? 0 : -100)}T00:00:00+09:00`);
  }
  const insertVisit = db.prepare('INSERT INTO site_visit_daily VALUES (?, ?, ?, ?, ?, ?)');
  function visit(visitor, date, path, views = 1) {
    insertVisit.run(visitor, date, path, views, `${date}T00:00:00Z`, `${date}T01:00:00Z`);
  }
  function entry(id, visitor, date, path, source, basis = 'legacy', hour = 11) {
    const started = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`).toISOString();
    if (evidence) {
      db.prepare('INSERT INTO site_visit_sessions (session_id, visitor_hash, started_at, visit_date, landing_path, source, source_basis) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, visitor, started, date, path, source, basis);
    } else {
      db.prepare('INSERT INTO site_visit_sessions (session_id, visitor_hash, started_at, visit_date, landing_path, source) VALUES (?, ?, ?, ?, ?, ?)').run(id, visitor, started, date, path, source);
    }
  }
  if (seed) {
    for (let offset = 0; offset < 65; offset++) {
      const date = shiftAnalyticsDate(today, -offset);
      const count = offset === 0 ? 12 : 17 + offset % 9;
      const hourRange = offset === 0 ? new Date(now.getTime() + 9 * 3600000).getUTCHours() + 1 : 24;
      for (let i = 0; i < count; i++) {
        const id = `sample-visitor-${i}`;
        visit(id, date, '/', 1 + (i % 3));
        if (i % 2 === 0) visit(id, date, '/works', 1);
        if (i % 3 === 0) visit(id, date, '/works/panel-paint', 1);
        if (i % 2 === 0) visit(id, date, `/works/detail/${cases[i % 5][0]}`, 1 + (i % 2));
        // Simulate recent rollout: old visits deliberately have no attribution.
        if (acquisition && offset < 6) {
          const source = ['naver-search', 'google', 'naver-blog', 'direct', 'naver-place', 'google-ad', 'after-call-sms'][i % 7];
          const path = source === 'after-call-sms' ? '/works' : i % 2 === 0 ? `/works/detail/${cases[i % 5][0]}` : '/';
          const basis = offset > 1 ? 'legacy' : source === 'direct'
            ? ['no-referrer', 'unsupported-referrer', 'unrecognized-tag'][Math.floor(i / 7) % 3]
            : source === 'google-ad' ? 'ad-tag'
            : ['after-call-sms', 'naver-blog', 'naver-place'].includes(source) ? 'link-tag' : 'web-referrer';
          entry(`session-${offset}-${i}`, id, date, path, source, basis, (i * 3) % hourRange);
          if (i % 5 === 0) entry(`return-${offset}-${i}`, id, date, '/', 'direct', offset > 1 ? 'legacy' : 'no-referrer', (i * 3 + 1) % hourRange);
        }
      }
    }
  }
  const queries = [];
  const env = { ACEDENT_DB: {
    prepare(sql) {
      const stmt = db.prepare(sql);
      let values = [];
      const record = () => { queries.push({ sql, values }); };
      return {
        bind(...args) { values = args; return this; },
        async all() { record(); return { results: stmt.all(...values) }; },
        async first() { record(); return stmt.get(...values) ?? null; },
        async run() { record(); const result = stmt.run(...values); return { success: true, meta: { changes: result.changes } }; },
      };
    },
  } };
  return { db, env, visit, entry, today, queries };
}
