import { type AdminEnv, json, requireAccess } from '../../_shared/admin';
import { WORK_CATEGORIES } from '../../../content/works/types';
import { getWorkPartFromRouteSlug } from '../../../lib/work-landings';
import { analyticsDate, analyticsPeriod, selectedAnalyticsPeriod } from '../../../lib/admin-analytics';
import { isVisitSource, type VisitAcquisition } from '../../../lib/visit-acquisition';

const OWNER_COOKIE = 'acedent_owner_excluded';

interface SummaryRow {
  today_visitors: number | string | null;
  today_views: number | string | null;
  week_visitors: number | string | null;
  week_views: number | string | null;
  month_visitors: number | string | null;
  month_views: number | string | null;
  all_visitors: number | string | null;
  all_views: number | string | null;
}

interface DailyRow {
  date: string;
  visitors: number | string;
  views: number | string;
}

interface TopPageRow {
  path: string;
  visitors: number | string;
  views: number | string;
}

interface PeriodRow {
  visitors: number | string | null;
  views: number | string | null;
}

interface PageGroupRow {
  page_group: 'home' | 'works' | 'category' | 'detail' | 'other';
  visitors: number | string;
  views: number | string;
}

interface WorkLabelRow {
  slug: string;
  payload_json: string;
  created_at: string;
}

async function readAcquisition(db: D1Database, start: string, end: string) {
  try {
    const [first, rows] = await Promise.all([
      db.prepare('SELECT MIN(started_at) AS started_at FROM site_visit_sessions').first<{ started_at: string | null }>(),
      db.prepare(`SELECT source, landing_path AS path, COUNT(*) AS entries
        FROM site_visit_sessions WHERE visit_date BETWEEN ? AND ?
        GROUP BY source, landing_path ORDER BY entries DESC, landing_path ASC`)
        .bind(start, end).all<{ source: string; path: string; entries: number }>(),
    ]);
    return { available: true, trackingSince: first?.started_at || null, rows: rows.results };
  } catch (error) {
    // Only the new section degrades when migration has not yet been applied.
    const missing = error instanceof Error && /no such table: (?:main\.)?site_visit_sessions/i.test(error.message);
    return { available: false, error: missing ? 'migration-required' as const : 'unavailable' as const, trackingSince: null, rows: [] };
  }
}

function hasOwnerCookie(request: Request) {
  return (request.headers.get('Cookie') || '')
    .split(';')
    .some((item) => item.trim() === `${OWNER_COOKIE}=1`);
}

function numeric(value: number | string | null | undefined) {
  return Number(value || 0);
}

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pageDetails(pathValue: string, workLabels: Map<string, string>) {
  const path = decodePath(pathValue).replace(/\/+$/, '') || '/';
  if (path === '/') return { label: '홈', type: 'home' as const };
  if (path === '/works') return { label: '전체 수리사례', type: 'works' as const };

  const detailMatch = path.match(/^\/works\/detail\/([^/]+)$/);
  if (detailMatch) {
    return {
      label: workLabels.get(detailMatch[1]) || `수리사례 · ${detailMatch[1]}`,
      type: 'detail' as const,
    };
  }

  const categoryMatch = path.match(/^\/works\/([^/]+)$/);
  const category = categoryMatch
    ? WORK_CATEGORIES.find((item) => item.id === categoryMatch[1])
    : undefined;
  if (category) return { label: `${category.label} 수리사례`, type: 'category' as const };

  const landingMatch = path.match(/^\/works\/([^/]+)\/([^/]+)$/);
  const landingCategory = landingMatch
    ? WORK_CATEGORIES.find((item) => item.id === landingMatch[1])
    : undefined;
  const landingPart = landingMatch ? getWorkPartFromRouteSlug(landingMatch[2]) : undefined;
  if (landingCategory && landingPart) {
    return {
      label: `${landingCategory.label} · ${landingPart} 사례`,
      type: 'category' as const,
    };
  }

  return { label: path, type: 'other' as const };
}

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = await requireAccess(request, env);
  if (!access.ok) return access.response;

  return Response.json({ excluded: true }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Set-Cookie': `${OWNER_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    },
  });
};

export const onRequestGet: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const access = await requireAccess(request, env);
  if (!access.ok) return access.response;

  if (!env.ACEDENT_DB) return json({ error: 'D1 바인딩이 설정되지 않았습니다.' }, 503);
  const now = new Date();
  let selected;
  try {
    selected = selectedAnalyticsPeriod(new URL(request.url).searchParams, now);
  } catch {
    return json({ error: '오늘까지의 올바른 날짜를 선택해 주세요.' }, 400);
  }
  const { today, days: periodDays, start: periodStart, end: periodEnd, previousStart, previousEnd, isPartial } = selected;
  const { start: weekStart, end: yesterday } = analyticsPeriod(7, now);
  const monthStart = analyticsPeriod(30, now).start;

  const [summary, period, previousPeriod, daily, pageGroups, topPages, previousPages, firstVisit, workRows, acquisitionRows] = await Promise.all([
    env.ACEDENT_DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN visit_date = ? THEN visitor_hash END) AS today_visitors,
        COALESCE(SUM(CASE WHEN visit_date = ? THEN page_views ELSE 0 END), 0) AS today_views,
        COUNT(DISTINCT CASE WHEN visit_date BETWEEN ? AND ? THEN visitor_hash END) AS week_visitors,
        COALESCE(SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN page_views ELSE 0 END), 0) AS week_views,
        COUNT(DISTINCT CASE WHEN visit_date BETWEEN ? AND ? THEN visitor_hash END) AS month_visitors,
        COALESCE(SUM(CASE WHEN visit_date BETWEEN ? AND ? THEN page_views ELSE 0 END), 0) AS month_views,
        COUNT(DISTINCT visitor_hash) AS all_visitors,
        COALESCE(SUM(page_views), 0) AS all_views
      FROM site_visit_daily
    `).bind(today, today, weekStart, yesterday, weekStart, yesterday, monthStart, yesterday, monthStart, yesterday).first<SummaryRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT COUNT(DISTINCT visitor_hash) AS visitors,
        COALESCE(SUM(page_views), 0) AS views
      FROM site_visit_daily
      WHERE visit_date BETWEEN ? AND ?
    `).bind(periodStart, periodEnd).first<PeriodRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT COUNT(DISTINCT visitor_hash) AS visitors,
        COALESCE(SUM(page_views), 0) AS views
      FROM site_visit_daily
      WHERE visit_date BETWEEN ? AND ?
    `).bind(previousStart, previousEnd).first<PeriodRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT visit_date AS date,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(page_views) AS views
      FROM site_visit_daily
      WHERE visit_date BETWEEN ? AND ?
      GROUP BY visit_date
      ORDER BY visit_date ASC
    `).bind(periodStart, periodEnd).all<DailyRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT CASE
          WHEN path = '/' THEN 'home'
          WHEN path = '/works' THEN 'works'
          WHEN path LIKE '/works/detail/%' THEN 'detail'
          WHEN path LIKE '/works/%' THEN 'category'
          ELSE 'other'
        END AS page_group,
        COUNT(DISTINCT visitor_hash) AS visitors,
        COALESCE(SUM(page_views), 0) AS views
      FROM site_visit_daily
      WHERE visit_date BETWEEN ? AND ?
      GROUP BY page_group
      ORDER BY views DESC
    `).bind(periodStart, periodEnd).all<PageGroupRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT path,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(page_views) AS views
      FROM site_visit_daily
      WHERE visit_date BETWEEN ? AND ?
      GROUP BY path
      ORDER BY visitors DESC, views DESC
    `).bind(periodStart, periodEnd).all<TopPageRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT path, COUNT(DISTINCT visitor_hash) AS visitors, SUM(page_views) AS views
      FROM site_visit_daily WHERE visit_date BETWEEN ? AND ? GROUP BY path
    `).bind(previousStart, previousEnd).all<TopPageRow>(),
    env.ACEDENT_DB.prepare('SELECT MIN(visit_date) AS first_date FROM site_visit_daily')
      .first<{ first_date: string | null }>(),
    env.ACEDENT_DB.prepare(`
      SELECT slug, payload_json, created_at
      FROM works
      WHERE status = 'published'
    `).all<WorkLabelRow>(),
    readAcquisition(env.ACEDENT_DB, periodStart, periodEnd),
  ]);

  const workLabels = new Map<string, string>();
  const registrationDates = new Map<string, string>();
  for (const row of workRows.results) {
    const created = new Date(row.created_at);
    if (!Number.isNaN(created.getTime())) registrationDates.set(`/works/detail/${row.slug}`, analyticsDate(created));
    try {
      const work = JSON.parse(row.payload_json) as {
        title?: string;
        carMaker?: string;
        carModel?: string;
      };
      const car = [work.carMaker, work.carModel].filter(Boolean).join(' ');
      const label = [car, work.title].filter(Boolean).join(' · ');
      if (label) workLabels.set(row.slug, label);
    } catch {
      // 손상된 사례 데이터가 있어도 방문 통계 전체를 표시할 수 있어야 합니다.
    }
  }

  const currentByPath = new Map(topPages.results.map((row) => [row.path, row]));
  const previousByPath = new Map(previousPages.results.map((row) => [row.path, row]));
  const publishedPaths = new Set(workRows.results.map((row) => `/works/detail/${row.slug}`));
  const paths = new Set([...currentByPath.keys(), ...previousByPath.keys(), ...publishedPaths]);
  const pages = [...paths].map((path) => ({
    path,
    ...pageDetails(path, workLabels),
    visitors: numeric(currentByPath.get(path)?.visitors),
    views: numeric(currentByPath.get(path)?.views),
    previousVisitors: numeric(previousByPath.get(path)?.visitors),
    previousViews: numeric(previousByPath.get(path)?.views),
    registeredOn: registrationDates.get(path) || null,
    isPublished: !path.startsWith('/works/detail/') || publishedPaths.has(path),
  })).sort((a, b) => b.visitors - a.visitors || b.views - a.views || a.path.localeCompare(b.path));

  const acquisition: VisitAcquisition = {
    ...acquisitionRows,
    total: acquisitionRows.rows.reduce((sum, row) => sum + numeric(row.entries), 0),
    rows: acquisitionRows.rows.map((row) => ({
      source: isVisitSource(row.source) ? row.source : 'other',
      path: row.path,
      label: pageDetails(row.path, workLabels).label,
      entries: numeric(row.entries),
      isPublished: !row.path.startsWith('/works/detail/') || publishedPaths.has(row.path),
    })),
  };

  return json({
    acquisition,
    generatedAt: now.toISOString(),
    today,
    excluded: hasOwnerCookie(request),
    trackingSince: firstVisit?.first_date || null,
    period: {
      days: periodDays,
      start: periodStart,
      end: periodEnd,
      previousStart,
      previousEnd,
      isPartial,
      // The first collection day may itself be partial.
      comparable: !isPartial && Boolean(firstVisit?.first_date && firstVisit.first_date < previousStart),
      visitors: numeric(period?.visitors),
      views: numeric(period?.views),
      previousVisitors: numeric(previousPeriod?.visitors),
      previousViews: numeric(previousPeriod?.views),
    },
    stats: {
      todayVisitors: numeric(summary?.today_visitors),
      todayViews: numeric(summary?.today_views),
      weekVisitors: numeric(summary?.week_visitors),
      weekViews: numeric(summary?.week_views),
      monthVisitors: numeric(summary?.month_visitors),
      monthViews: numeric(summary?.month_views),
      allVisitors: numeric(summary?.all_visitors),
      allViews: numeric(summary?.all_views),
    },
    daily: daily.results.map((row) => ({
      date: row.date,
      visitors: numeric(row.visitors),
      views: numeric(row.views),
    })),
    pageGroups: pageGroups.results.map((row) => ({
      type: row.page_group,
      visitors: numeric(row.visitors),
      views: numeric(row.views),
    })),
    topPages: pages,
  });
};
