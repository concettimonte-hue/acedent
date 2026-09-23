import { type AdminEnv, json, requireAccess } from '../../_shared/admin';
import { WORK_CATEGORIES } from '../../../content/works/types';
import { getWorkPartFromRouteSlug } from '../../../lib/work-landings';

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
}

function hasOwnerCookie(request: Request) {
  return (request.headers.get('Cookie') || '')
    .split(';')
    .some((item) => item.trim() === `${OWNER_COOKIE}=1`);
}

function koreanDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function daysAgo(days: number) {
  return koreanDate(new Date(Date.now() - days * 86_400_000));
}

function numeric(value: number | string | null | undefined) {
  return Number(value || 0);
}

function selectedDays(request: Request) {
  const value = Number(new URL(request.url).searchParams.get('days') || 30);
  return value === 7 || value === 90 ? value : 30;
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

export const onRequestPost: PagesFunction<AdminEnv> = async ({ request }) => {
  const access = requireAccess(request);
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
  const access = requireAccess(request);
  if (!access.ok) return access.response;

  const periodDays = selectedDays(request);
  const today = koreanDate();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);
  const periodStart = daysAgo(periodDays - 1);
  const previousStart = daysAgo(periodDays * 2 - 1);
  const previousEnd = daysAgo(periodDays);

  const [summary, period, previousPeriod, daily, pageGroups, topPages, firstVisit, workRows] = await Promise.all([
    env.ACEDENT_DB.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN visit_date = ? THEN visitor_hash END) AS today_visitors,
        COALESCE(SUM(CASE WHEN visit_date = ? THEN page_views ELSE 0 END), 0) AS today_views,
        COUNT(DISTINCT CASE WHEN visit_date >= ? THEN visitor_hash END) AS week_visitors,
        COALESCE(SUM(CASE WHEN visit_date >= ? THEN page_views ELSE 0 END), 0) AS week_views,
        COUNT(DISTINCT CASE WHEN visit_date >= ? THEN visitor_hash END) AS month_visitors,
        COALESCE(SUM(CASE WHEN visit_date >= ? THEN page_views ELSE 0 END), 0) AS month_views,
        COUNT(DISTINCT visitor_hash) AS all_visitors,
        COALESCE(SUM(page_views), 0) AS all_views
      FROM site_visit_daily
    `).bind(today, today, weekStart, weekStart, monthStart, monthStart).first<SummaryRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT COUNT(DISTINCT visitor_hash) AS visitors,
        COALESCE(SUM(page_views), 0) AS views
      FROM site_visit_daily
      WHERE visit_date >= ?
    `).bind(periodStart).first<PeriodRow>(),
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
      WHERE visit_date >= ?
      GROUP BY visit_date
      ORDER BY visit_date ASC
    `).bind(periodStart).all<DailyRow>(),
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
      WHERE visit_date >= ?
      GROUP BY page_group
      ORDER BY views DESC
    `).bind(periodStart).all<PageGroupRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT path,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(page_views) AS views
      FROM site_visit_daily
      WHERE visit_date >= ?
      GROUP BY path
      ORDER BY visitors DESC, views DESC
      LIMIT 20
    `).bind(periodStart).all<TopPageRow>(),
    env.ACEDENT_DB.prepare('SELECT MIN(visit_date) AS first_date FROM site_visit_daily')
      .first<{ first_date: string | null }>(),
    env.ACEDENT_DB.prepare(`
      SELECT slug, payload_json
      FROM works
      WHERE status = 'published'
    `).all<WorkLabelRow>(),
  ]);

  const workLabels = new Map<string, string>();
  for (const row of workRows.results) {
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

  return json({
    excluded: hasOwnerCookie(request),
    trackingSince: firstVisit?.first_date || null,
    period: {
      days: periodDays,
      start: periodStart,
      end: today,
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
    topPages: topPages.results.map((row) => ({
      path: row.path,
      ...pageDetails(row.path, workLabels),
      visitors: numeric(row.visitors),
      views: numeric(row.views),
    })),
  });
};
