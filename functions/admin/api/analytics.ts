import { type AdminEnv, json, requireAccess } from '../../_shared/admin';

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

  const today = koreanDate();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);
  const chartStart = daysAgo(13);

  const [summary, daily, topPages, firstVisit] = await Promise.all([
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
      SELECT visit_date AS date,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(page_views) AS views
      FROM site_visit_daily
      WHERE visit_date >= ?
      GROUP BY visit_date
      ORDER BY visit_date ASC
    `).bind(chartStart).all<DailyRow>(),
    env.ACEDENT_DB.prepare(`
      SELECT path,
        COUNT(DISTINCT visitor_hash) AS visitors,
        SUM(page_views) AS views
      FROM site_visit_daily
      WHERE visit_date >= ?
      GROUP BY path
      ORDER BY visitors DESC, views DESC
      LIMIT 5
    `).bind(monthStart).all<TopPageRow>(),
    env.ACEDENT_DB.prepare('SELECT MIN(visit_date) AS first_date FROM site_visit_daily')
      .first<{ first_date: string | null }>(),
  ]);

  return json({
    excluded: hasOwnerCookie(request),
    trackingSince: firstVisit?.first_date || null,
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
    topPages: topPages.results.map((row) => ({
      path: row.path,
      visitors: numeric(row.visitors),
      views: numeric(row.views),
    })),
  });
};
