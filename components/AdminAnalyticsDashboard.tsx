'use client';

/* oxlint-disable next/no-html-link-for-pages -- Vite SPA routes are intentional. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ExternalLink,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';

type PeriodDays = 7 | 30 | 90;
type PageType = 'home' | 'works' | 'category' | 'detail' | 'other';

interface AnalyticsResult {
  excluded: boolean;
  trackingSince: string | null;
  period: {
    days: PeriodDays;
    start: string;
    end: string;
    visitors: number;
    views: number;
    previousVisitors: number;
    previousViews: number;
  };
  stats: {
    todayVisitors: number;
    todayViews: number;
    allVisitors: number;
    allViews: number;
  };
  daily: Array<{ date: string; visitors: number; views: number }>;
  pageGroups: Array<{ type: PageType; visitors: number; views: number }>;
  topPages: Array<{
    path: string;
    label: string;
    type: PageType;
    visitors: number;
    views: number;
  }>;
  error?: string;
}

const PERIODS: PeriodDays[] = [7, 30, 90];
const GROUP_LABELS: Record<PageType, string> = {
  home: '홈',
  works: '수리사례 목록',
  category: '카테고리·부위',
  detail: '사례 상세',
  other: '기타 페이지',
};

function comparison(current: number, previous: number) {
  if (previous === 0) return current === 0 ? { text: '변동 없음', direction: 'same' } : { text: '신규 집계', direction: 'up' };
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { text: '이전 기간과 동일', direction: 'same' };
  return {
    text: `${Math.abs(percent).toLocaleString()}% ${percent > 0 ? '증가' : '감소'}`,
    direction: percent > 0 ? 'up' : 'down',
  };
}

function shortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export default function AdminAnalyticsDashboard() {
  const [days, setDays] = useState<PeriodDays>(30);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (period: PeriodDays) => {
    setLoading(true);
    setError('');
    try {
      const exclusionResponse = await fetch('/admin/api/analytics', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!exclusionResponse.ok) {
        const exclusionPayload = await exclusionResponse.json() as { error?: string };
        throw new Error(exclusionPayload.error || '관리자 방문 제외 설정에 실패했습니다.');
      }

      const response = await fetch(`/admin/api/analytics?days=${period}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const payload = await response.json() as AnalyticsResult;
      if (!response.ok || !payload.period) throw new Error(payload.error || '방문 통계를 불러오지 못했습니다.');
      setAnalytics(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '방문 통계를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(days);
  }, [days, loadAnalytics]);

  const dailyRows = useMemo(() => {
    if (!analytics) return [];
    const rows = new Map(analytics.daily.map((row) => [row.date, row]));
    const end = new Date(`${analytics.period.end}T12:00:00+09:00`);
    return Array.from({ length: analytics.period.days }, (_, index) => {
      const date = new Date(end);
      date.setDate(end.getDate() - (analytics.period.days - index - 1));
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      return rows.get(key) || { date: key, visitors: 0, views: 0 };
    });
  }, [analytics]);

  const maxDailyViews = Math.max(1, ...dailyRows.map((row) => row.views));
  const visitorTrend = analytics ? comparison(analytics.period.visitors, analytics.period.previousVisitors) : null;
  const viewTrend = analytics ? comparison(analytics.period.views, analytics.period.previousViews) : null;
  const groupMap = new Map(analytics?.pageGroups.map((row) => [row.type, row]) || []);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" aria-label="에이스덴트 홈페이지">ACE DENT</a>
        <div><span>ADMIN</span><strong>방문 통계</strong></div>
      </header>

      <section className="admin-list-shell admin-analytics-shell">
        <nav className="admin-section-nav" aria-label="관리자 메뉴">
          <a href="/admin">사례 관리</a>
          <a className="is-active" href="/admin?view=analytics">방문 통계</a>
        </nav>

        <div className="admin-list-heading admin-analytics-title">
          <div>
            <span>PRIVATE ANALYTICS</span>
            <h1>사이트 방문 흐름</h1>
            <p>나의 방문을 제외하고, 방문자가 어떤 공개 페이지를 확인했는지 집계합니다.</p>
          </div>
          <button type="button" onClick={() => void loadAnalytics(days)} disabled={loading}>
            <RefreshCw aria-hidden="true" /> 새로고침
          </button>
        </div>

        <div className="admin-analytics-period" aria-label="통계 기간">
          {PERIODS.map((period) => (
            <button
              className={days === period ? 'is-active' : ''}
              key={period}
              type="button"
              onClick={() => setDays(period)}
            >
              {period}일
            </button>
          ))}
        </div>

        {error ? (
          <div className="admin-analytics-empty is-error" role="alert">{error}</div>
        ) : loading || !analytics ? (
          <div className="admin-analytics-empty">방문 통계를 불러오는 중입니다.</div>
        ) : (
          <>
            <section className="admin-analytics-metrics" aria-label={`${days}일 핵심 지표`}>
              <article>
                <span><Users aria-hidden="true" /> 방문자</span>
                <strong>{analytics.period.visitors.toLocaleString()}<small>명</small></strong>
                <p className={`is-${visitorTrend?.direction}`}>
                  {visitorTrend?.direction === 'up' && <TrendingUp aria-hidden="true" />}
                  {visitorTrend?.direction === 'down' && <TrendingDown aria-hidden="true" />}
                  {visitorTrend?.text}
                </p>
              </article>
              <article>
                <span><BarChart3 aria-hidden="true" /> 페이지 조회</span>
                <strong>{analytics.period.views.toLocaleString()}<small>회</small></strong>
                <p className={`is-${viewTrend?.direction}`}>
                  {viewTrend?.direction === 'up' && <TrendingUp aria-hidden="true" />}
                  {viewTrend?.direction === 'down' && <TrendingDown aria-hidden="true" />}
                  {viewTrend?.text}
                </p>
              </article>
              <article>
                <span>방문자당 조회</span>
                <strong>{analytics.period.visitors ? (analytics.period.views / analytics.period.visitors).toFixed(1) : '0'}<small>회</small></strong>
                <p>{analytics.period.start} – {analytics.period.end}</p>
              </article>
              <article>
                <span>오늘</span>
                <strong>{analytics.stats.todayVisitors.toLocaleString()}<small>명</small></strong>
                <p>조회 {analytics.stats.todayViews.toLocaleString()}회</p>
              </article>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-flow-heading">
              <header>
                <div>
                  <span>PAGE FLOW</span>
                  <h2 id="analytics-flow-heading">페이지 유형별 도달</h2>
                </div>
                <p>한 방문자가 여러 유형을 볼 수 있어 합계는 전체 방문자 수와 다를 수 있습니다.</p>
              </header>
              <div className="admin-analytics-groups">
                {(['home', 'works', 'category', 'detail'] as PageType[]).map((type) => {
                  const row = groupMap.get(type);
                  const visitors = row?.visitors || 0;
                  const width = analytics.period.visitors
                    ? Math.min(100, Math.round((visitors / analytics.period.visitors) * 100))
                    : 0;
                  return (
                    <article key={type}>
                      <div><strong>{GROUP_LABELS[type]}</strong><span>{visitors.toLocaleString()}명 · {row?.views.toLocaleString() || 0}회</span></div>
                      <div className="admin-analytics-progress" aria-label={`${GROUP_LABELS[type]} 방문자 비율 ${width}%`}>
                        <span style={{ width: `${width}%` }} />
                      </div>
                      <small>전체 방문자 대비 {width}%</small>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-daily-heading">
              <header>
                <div>
                  <span>DAILY VIEWS</span>
                  <h2 id="analytics-daily-heading">일별 페이지 조회</h2>
                </div>
                <p>막대를 누르거나 마우스를 올리면 날짜별 방문자와 조회 수를 확인할 수 있습니다.</p>
              </header>
              <div className="admin-analytics-chart" data-days={days}>
                {dailyRows.map((row, index) => (
                  <div className="admin-analytics-day" key={row.date} title={`${row.date} · ${row.visitors}명 · ${row.views}회`}>
                    <span>{row.views || ''}</span>
                    <i style={{ height: `${Math.max(row.views ? 8 : 2, Math.round((row.views / maxDailyViews) * 100))}%` }} />
                    <small>{days === 7 || index % (days === 30 ? 5 : 15) === 0 || index === dailyRows.length - 1 ? shortDate(row.date) : ''}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="admin-analytics-section" aria-labelledby="analytics-pages-heading">
              <header>
                <div>
                  <span>TOP PAGES</span>
                  <h2 id="analytics-pages-heading">많이 본 페이지</h2>
                </div>
                <p>공개 페이지 이름과 실제 경로를 함께 표시합니다.</p>
              </header>
              {analytics.topPages.length === 0 ? (
                <div className="admin-analytics-empty">아직 이 기간에 집계된 방문이 없습니다.</div>
              ) : (
                <ol className="admin-analytics-pages">
                  {analytics.topPages.map((page, index) => {
                    const share = analytics.period.views ? Math.round((page.views / analytics.period.views) * 100) : 0;
                    return (
                      <li key={page.path}>
                        <span className="admin-analytics-rank">{String(index + 1).padStart(2, '0')}</span>
                        <div>
                          <strong>{page.label}</strong>
                          <code>{page.path}</code>
                        </div>
                        <span className="admin-analytics-type">{GROUP_LABELS[page.type]}</span>
                        <p><strong>{page.visitors.toLocaleString()}</strong>명 <span>{page.views.toLocaleString()}회 · {share}%</span></p>
                        <a href={page.path} target="_blank" rel="noopener noreferrer" aria-label={`${page.label} 새 탭에서 보기`}>
                          <ExternalLink aria-hidden="true" />
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <aside className="admin-analytics-note">
              <p><strong>집계 기준</strong> {analytics.trackingSince ? `${analytics.trackingSince}부터` : '배포 후부터'} · 이 관리자 브라우저는 제외 쿠키가 설정됩니다. 쿠키 삭제·기기 변경 시 새 방문자로 계산될 수 있습니다.</p>
              <p><strong>검색 유입</strong> 검색어·노출·클릭은 GA4와 Search Console을 연결한 뒤 Google 보고서에서 확인하는 것이 가장 정확합니다.</p>
            </aside>
          </>
        )}
      </section>
    </main>
  );
}
